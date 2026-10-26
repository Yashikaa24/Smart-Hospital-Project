from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from .. import models, schemas
from ..websocket_manager import ws_manager
from datetime import datetime, timedelta
import qrcode
import io
import os
import math
import json
from fastapi.responses import Response
from apscheduler.schedulers.background import BackgroundScheduler
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

def calculate_distance(lat1, lon1, lat2, lon2):
    """Haversine formula to compute distance in km between two GPS points."""
    try:
        lat1, lon1, lat2, lon2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        return c * 6371.0
    except Exception:
        return 9999.0

def cancel_unclaimed_half_token(token_id: str, db_session_factory):
    """APScheduler task to auto-cancel Half Token if patient never reports to hospital in time."""
    db = db_session_factory()
    try:
        token = db.query(models.Token).filter(models.Token.id == token_id).first()
        if token and token.is_half and token.status == 'waiting':
            token.status = 'cancelled'
            db.commit()
            print(f"Half Token {token_id} auto-cancelled after expiration time.")
    finally:
        db.close()

def auto_cancel_token(token_id: str, db_session_factory):
    """APScheduler task to auto-cancel token if patient doesn't show up."""
    db = db_session_factory()
    try:
        token = db.query(models.Token).filter(models.Token.id == token_id).first()
        if token and token.status == 'called':
            token.status = 'cancelled'
            db.commit()
            print(f"Token {token_id} auto-cancelled after 5 minutes.")
    finally:
        db.close()

@router.post("/create", response_model=schemas.Token)
async def create_token(token_data: schemas.TokenCreate, request: Request, db: Session = Depends(get_db)):
    # Verify doctor exists
    doctor = db.query(models.Doctor).filter(models.Doctor.id == token_data.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor ID not found in database")

    # Get last token number for the doctor today
    last_token = db.query(func.max(models.Token.token_number)).filter(
        models.Token.doctor_id == token_data.doctor_id,
        func.date(models.Token.created_at) == func.current_date()
    ).scalar() or 0
    
    new_token = models.Token(
        doctor_id=token_data.doctor_id,
        patient_name=token_data.patient_name,
        phone=token_data.phone,
        is_half=token_data.is_half,
        token_number=last_token + 1,
        status='waiting'
    )
    db.add(new_token)
    db.commit()
    db.refresh(new_token)
    
    # If it is a Half Token, schedule automatic cancellation check
    if token_data.is_half:
        timeout_minutes = int(os.getenv("HALF_TOKEN_TIMEOUT_MINUTES", "15"))
        scheduler: BackgroundScheduler = request.app.state.scheduler
        from ..database import SessionLocal
        scheduler.add_job(
            cancel_unclaimed_half_token, 
            'date', 
            run_date=datetime.now() + timedelta(minutes=timeout_minutes),
            args=[new_token.id, SessionLocal]
        )
        print(f"Scheduled cancellation timer for Half Token {new_token.id} in {timeout_minutes} minutes.")
        
    doctor = db.query(models.Doctor).filter(models.Doctor.id == new_token.doctor_id).first()
    if doctor:
        hospital = db.query(models.Hospital).filter(models.Hospital.id == doctor.hospital_id).first()
        if hospital:
            new_token.hospital_lat = float(hospital.latitude) if hospital.latitude else None
            new_token.hospital_lng = float(hospital.longitude) if hospital.longitude else None
            
    # Broadcast to all clients
    await ws_manager.broadcast({"type": "QUEUE_UPDATE", "doctor_id": token_data.doctor_id})
            
    return new_token

@router.get("/queue/{doctor_id}")
def get_queue(doctor_id: str, db: Session = Depends(get_db)):
    tokens = db.query(models.Token).filter(
        models.Token.doctor_id == doctor_id,
        models.Token.status.in_(['waiting', 'called', 'present'])
    ).order_by(models.Token.token_number).all()
    
    from ..services.prediction_service import PredictionService
    
    queue_data = []
    for t in tokens:
        pred = PredictionService.predict_wait_time(doctor_id, t.token_number, t.is_half, db)
        
        queue_data.append({
            "id": t.id,
            "patient_name": t.patient_name,
            "token_number": t.token_number,
            "status": t.status,
            "is_half": t.is_half,
            "eta_minutes": pred["eta_minutes"],
            "patients_ahead": pred["patients_ahead"],
            "current_token": pred["current_token"],
            "confidence": pred["confidence"]
        })
    
    return queue_data

@router.get("/{token_id}", response_model=schemas.Token)
def get_token_details(token_id: str, db: Session = Depends(get_db)):
    token = db.query(models.Token).filter(models.Token.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
        
    from ..services.prediction_service import PredictionService
    pred = PredictionService.predict_wait_time(token.doctor_id, token.token_number, token.is_half, db)
    
    # Map predictions to schema fields
    token.eta_minutes = pred["eta_minutes"]
    token.patients_ahead = pred["patients_ahead"]
    token.current_token = pred["current_token"]
    token.confidence = pred["confidence"]
    
    doctor = db.query(models.Doctor).filter(models.Doctor.id == token.doctor_id).first()
    if doctor:
        hospital = db.query(models.Hospital).filter(models.Hospital.id == doctor.hospital_id).first()
        if hospital:
            token.hospital_lat = float(hospital.latitude) if hospital.latitude else None
            token.hospital_lng = float(hospital.longitude) if hospital.longitude else None
            
    return token

@router.post("/call/{token_id}")
async def call_patient(token_id: str, request: Request, db: Session = Depends(get_db)):
    token = db.query(models.Token).filter(models.Token.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    token.status = 'called'
    token.called_at = datetime.utcnow()
    db.commit()
    
    # Schedule auto-cancel in 5 minutes
    scheduler: BackgroundScheduler = request.app.state.scheduler
    from ..database import SessionLocal
    scheduler.add_job(
        auto_cancel_token, 
        'date', 
        run_date=datetime.now() + timedelta(minutes=5),
        args=[token_id, SessionLocal]
    )
    
    # Broadcast to all clients
    await ws_manager.broadcast({"type": "QUEUE_UPDATE", "doctor_id": token.doctor_id})
    
    return {"message": "Patient called. 5-minute timer started.", "token": token}

@router.patch("/location/{token_id}")
async def update_location(token_id: str, loc: schemas.TokenLocationUpdate, db: Session = Depends(get_db)):
    token = db.query(models.Token).filter(models.Token.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    token.location_lat = loc.lat
    token.location_lng = loc.lng
    
    geofence_triggered = False
    if token.is_half:
        doctor = db.query(models.Doctor).filter(models.Doctor.id == token.doctor_id).first()
        if doctor:
            hospital = db.query(models.Hospital).filter(models.Hospital.id == doctor.hospital_id).first()
            if hospital and hospital.latitude and hospital.longitude:
                dist = calculate_distance(loc.lat, loc.lng, hospital.latitude, hospital.longitude)
                # 200 meters geofence
                if dist <= 0.2:
                    token.is_half = False
                    geofence_triggered = True
                    print(f"Token {token.id} crossed geofence ({dist:.3f} km). Converted to Full Token.")
                    
    db.commit()
    
    # Broadcast to all clients if geofence converted status
    if geofence_triggered:
        await ws_manager.broadcast({"type": "QUEUE_UPDATE", "doctor_id": token.doctor_id})
        
    return {
        "status": "success",
        "is_half": token.is_half,
        "geofence_triggered": geofence_triggered
    }

@router.patch("/{token_id}", response_model=schemas.Token)
async def update_token_status(token_id: str, update: schemas.TokenStatusUpdate, db: Session = Depends(get_db)):
    token = db.query(models.Token).filter(models.Token.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    if update.status not in ['waiting', 'called', 'present', 'completed', 'cancelled']:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    token.status = update.status
    db.commit()
    db.refresh(token)
    
    # Broadcast to all clients
    await ws_manager.broadcast({"type": "QUEUE_UPDATE", "doctor_id": token.doctor_id})
    
    return token

@router.delete("/{token_id}")
async def delete_token(token_id: str, db: Session = Depends(get_db)):
    token = db.query(models.Token).filter(models.Token.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
        
    d_id = token.doctor_id
    db.delete(token)
    db.commit()
    
    # Broadcast to all clients
    await ws_manager.broadcast({"type": "QUEUE_UPDATE", "doctor_id": d_id})
    
    return {"message": "Token deleted successfully"}

@router.get("/qr/{doctor_id}")
def get_qr(doctor_id: str, db: Session = Depends(get_db)):
    """Generate a QR code PNG for a doctor. Encodes structured JSON payload."""
    doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    hospital = db.query(models.Hospital).filter(models.Hospital.id == doctor.hospital_id).first()

    qr_payload = {
        "type": "hospital_qr",
        "doctor_id": doctor.id,
        "hospital_id": doctor.hospital_id,
        "department": doctor.department,
        "hospital_name": hospital.name if hospital else "",
        "doctor_name": doctor.name,
    }

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=4,
    )
    qr.add_data(json.dumps(qr_payload, separators=(',', ':')))
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return Response(content=buf.getvalue(), media_type="image/png")


class ScanValidateRequest(BaseModel):
    qr_data: str  # Raw JSON string from QR scan


class ScanCreateRequest(BaseModel):
    qr_data: str
    patient_name: str
    phone: str


@router.post("/scan-validate")
def scan_validate(payload: ScanValidateRequest, db: Session = Depends(get_db)):
    """Validate a scanned QR payload against the database. Returns doctor + hospital + queue info."""
    try:
        data = json.loads(payload.qr_data)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="invalid_qr")

    if data.get("type") != "hospital_qr":
        raise HTTPException(status_code=400, detail="invalid_qr")

    doctor_id = data.get("doctor_id")
    if not doctor_id:
        raise HTTPException(status_code=400, detail="invalid_qr")

    doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="doctor_not_found")

    hospital = db.query(models.Hospital).filter(models.Hospital.id == doctor.hospital_id).first()

    # Queue stats
    queue_count = db.query(models.Token).filter(
        models.Token.doctor_id == doctor.id,
        models.Token.status.in_(['waiting', 'called', 'present'])
    ).count()

    from ..services.prediction_service import PredictionService
    last_token = (
        db.query(func.max(models.Token.token_number))
        .filter(
            models.Token.doctor_id == doctor.id,
            func.date(models.Token.created_at) == func.current_date()
        )
        .scalar() or 0
    )
    pred = PredictionService.predict_wait_time(doctor.id, last_token + 1, False, db)

    # Suggest alternatives if doctor unavailable
    alternatives = []
    department_closed = False
    available_departments = []

    if not doctor.is_available:
        alts = db.query(models.Doctor).filter(
            models.Doctor.hospital_id == doctor.hospital_id,
            models.Doctor.department == doctor.department,
            models.Doctor.is_available == True,
            models.Doctor.id != doctor.id
        ).limit(3).all()
        alternatives = [{"id": a.id, "name": a.name, "department": a.department} for a in alts]

        # Check if the entire department is closed (no available doctors)
        if len(alternatives) == 0:
            department_closed = True
            # Find departments in this hospital that have at least one available doctor
            available_dept_rows = (
                db.query(models.Doctor.department)
                .filter(
                    models.Doctor.hospital_id == doctor.hospital_id,
                    models.Doctor.is_available == True,
                )
                .distinct()
                .all()
            )
            available_departments = [row[0] for row in available_dept_rows if row[0] != doctor.department]

    return {
        "valid": True,
        "doctor": {
            "id": doctor.id,
            "name": doctor.name,
            "department": doctor.department,
            "is_available": doctor.is_available,
            "avg_consult_minutes": doctor.avg_consult_minutes,
            "experience_years": doctor.experience_years,
            "specialization": doctor.specialization or doctor.department,
            "photo_url": doctor.photo_url,
        },
        "hospital": {
            "id": hospital.id if hospital else None,
            "name": hospital.name if hospital else data.get("hospital_name", ""),
            "address": hospital.address if hospital else None,
            "phone": hospital.phone if hospital else None,
        },
        "queue": {
            "patients_ahead": pred["patients_ahead"],
            "eta_minutes": pred["eta_minutes"],
            "current_token": pred["current_token"],
            "queue_count": queue_count,
        },
        "alternatives": alternatives,
        "department_closed": department_closed,
        "available_departments": available_departments,
    }


@router.post("/scan-create", response_model=schemas.Token)
async def scan_create(payload: ScanCreateRequest, request: Request, db: Session = Depends(get_db)):
    """Create a token from a scanned QR payload + patient info."""
    try:
        data = json.loads(payload.qr_data)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="invalid_qr")

    if data.get("type") != "hospital_qr":
        raise HTTPException(status_code=400, detail="invalid_qr")

    doctor_id = data.get("doctor_id")
    if not doctor_id:
        raise HTTPException(status_code=400, detail="invalid_qr")

    doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found in database")

    if not doctor.is_available:
        raise HTTPException(status_code=409, detail="doctor_unavailable")

    last_token = db.query(func.max(models.Token.token_number)).filter(
        models.Token.doctor_id == doctor_id,
        func.date(models.Token.created_at) == func.current_date()
    ).scalar() or 0

    new_token = models.Token(
        doctor_id=doctor_id,
        patient_name=payload.patient_name,
        phone=payload.phone,
        is_half=False,
        token_number=last_token + 1,
        status='waiting'
    )
    db.add(new_token)
    db.commit()
    db.refresh(new_token)

    hospital = db.query(models.Hospital).filter(models.Hospital.id == doctor.hospital_id).first()
    if hospital:
        new_token.hospital_lat = float(hospital.latitude) if hospital.latitude else None
        new_token.hospital_lng = float(hospital.longitude) if hospital.longitude else None

    await ws_manager.broadcast({"type": "QUEUE_UPDATE", "doctor_id": doctor_id})
    return new_token
