from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from .. import models, schemas
from typing import List, Optional
from .tokens import calculate_distance
from pydantic import BaseModel

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_crowd_level(total_waiting: int) -> str:
    if total_waiting < 3:
        return "Low"
    elif total_waiting < 8:
        return "Moderate"
    return "Heavy"


def _build_hospital_summary(h, db: Session, lat: Optional[float], lng: Optional[float]) -> schemas.Hospital:
    """Compute live stats (beds, ICU, crowd, wait) for a hospital and return the schema."""
    from ..services.prediction_service import PredictionService

    bed_res = db.query(models.Resource).filter(
        models.Resource.hospital_id == h.id,
        models.Resource.resource_type == "bed"
    ).first()
    icu_res = db.query(models.Resource).filter(
        models.Resource.hospital_id == h.id,
        models.Resource.resource_type == "icu"
    ).first()

    available_beds = bed_res.available if bed_res else 0
    icu_beds = icu_res.available if icu_res else 0

    doctors = db.query(models.Doctor).filter(models.Doctor.hospital_id == h.id).all()
    total_waiting = 0
    total_wait_time = 0
    active_doctors_count = 0

    for doc in doctors:
        queue_count = db.query(models.Token).filter(
            models.Token.doctor_id == doc.id,
            models.Token.status.in_(["waiting", "called", "present"])
        ).count()
        total_waiting += queue_count

        last_token = (
            db.query(func.max(models.Token.token_number))
            .filter(
                models.Token.doctor_id == doc.id,
                func.date(models.Token.created_at) == func.current_date()
            )
            .scalar() or 0
        )
        pred = PredictionService.predict_wait_time(doc.id, last_token + 1, True, db)
        total_wait_time += pred["eta_minutes"]
        active_doctors_count += 1

    avg_wait = int(total_wait_time / active_doctors_count) if active_doctors_count > 0 else 0
    crowd = _get_crowd_level(total_waiting)

    # Distance — compute from GPS if provided, otherwise null
    dist_str = None
    if lat is not None and lng is not None and h.latitude is not None and h.longitude is not None:
        dist = calculate_distance(lat, lng, h.latitude, h.longitude)
        dist_str = f"{dist:.1f} km"

    return schemas.Hospital(
        id=h.id,
        name=h.name,
        address=h.address,
        phone=h.phone,
        latitude=float(h.latitude) if h.latitude else None,
        longitude=float(h.longitude) if h.longitude else None,
        created_at=h.created_at,
        crowd_level=crowd,
        available_beds=available_beds,
        icu_beds=icu_beds,
        est_wait_time=avg_wait,
        status="Open",
        distance=dist_str,
    )


# ── Hospital CRUD ──────────────────────────────────────────────────────────────

@router.post("/", response_model=schemas.Hospital)
def create_hospital(hospital: schemas.HospitalCreate, db: Session = Depends(get_db)):
    db_hospital = models.Hospital(**hospital.model_dump())
    db.add(db_hospital)
    db.commit()
    db.refresh(db_hospital)
    return _build_hospital_summary(db_hospital, db, None, None)


@router.get("/", response_model=List[schemas.Hospital])
def get_hospitals(lat: Optional[float] = None, lng: Optional[float] = None, db: Session = Depends(get_db)):
    """Public endpoint — patients browse hospitals."""
    hospitals = db.query(models.Hospital).all()
    return [_build_hospital_summary(h, db, lat, lng) for h in hospitals]


# ── QR Data — for Demo QR page (MUST be above /{hospital_id} catch-all) ────────

@router.get("/qr-data")
def get_qr_data(db: Session = Depends(get_db)):
    """
    Returns all hospitals with their doctors and QR metadata.
    Used by the Demo QR Codes page to render a printable grid.
    """
    API_BASE = "/tokens/qr"
    hospitals = db.query(models.Hospital).order_by(models.Hospital.name).all()
    result = []
    for h in hospitals:
        doctors = db.query(models.Doctor).filter(models.Doctor.hospital_id == h.id).order_by(models.Doctor.department).all()
        doc_list = []
        for d in doctors:
            doc_list.append({
                "id": d.id,
                "name": d.name,
                "department": d.department,
                "specialization": d.specialization or d.department,
                "is_available": d.is_available,
                "qr_image_url": f"{API_BASE}/{d.id}",
                "qr_code_url": d.qr_code_url,  # stored base64 data URL
            })
        result.append({
            "id": h.id,
            "name": h.name,
            "address": h.address,
            "phone": h.phone,
            "doctors": doc_list,
        })
    return result


@router.get("/{hospital_id}", response_model=schemas.Hospital)
def get_hospital(hospital_id: str, db: Session = Depends(get_db)):
    """Fetch a single hospital's live summary by ID."""
    h = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return _build_hospital_summary(h, db, None, None)


@router.patch("/{hospital_id}", response_model=schemas.Hospital)
async def update_hospital(hospital_id: str, update: schemas.HospitalCreate, db: Session = Depends(get_db)):
    hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    for key, val in update.model_dump(exclude_unset=True).items():
        setattr(hospital, key, val)
    db.commit()
    db.refresh(hospital)
    from ..websocket_manager import ws_manager
    await ws_manager.broadcast({"type": "HOSPITAL_UPDATE", "hospital_id": hospital_id})
    return _build_hospital_summary(hospital, db, None, None)


@router.delete("/{hospital_id}")
async def delete_hospital(hospital_id: str, db: Session = Depends(get_db)):
    hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    db.delete(hospital)
    db.commit()
    from ..websocket_manager import ws_manager
    await ws_manager.broadcast({"type": "HOSPITAL_UPDATE", "hospital_id": hospital_id})
    return {"message": "Hospital deleted successfully"}


# ── Doctor Management ──────────────────────────────────────────────────────────

@router.post("/{hospital_id}/doctors", response_model=schemas.Doctor)
async def create_doctor(hospital_id: str, doctor: schemas.DoctorBase, db: Session = Depends(get_db)):
    db_doctor = models.Doctor(**doctor.model_dump(), hospital_id=hospital_id)
    db.add(db_doctor)
    db.commit()
    db.refresh(db_doctor)

    from ..websocket_manager import ws_manager
    await ws_manager.broadcast({"type": "DOCTOR_UPDATE", "hospital_id": hospital_id})

    return db_doctor


@router.get("/{hospital_id}/doctors", response_model=List[schemas.Doctor])
def get_hospital_doctors(hospital_id: str, db: Session = Depends(get_db)):
    return db.query(models.Doctor).filter(models.Doctor.hospital_id == hospital_id).all()


class DoctorUpdateSchema(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    is_available: Optional[bool] = None
    avg_consult_minutes: Optional[int] = None
    experience_years: Optional[int] = None
    specialization: Optional[str] = None
    photo_url: Optional[str] = None


@router.patch("/doctors/{doctor_id}", response_model=schemas.Doctor)
async def update_doctor(doctor_id: str, update: DoctorUpdateSchema, db: Session = Depends(get_db)):
    doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    for key, val in update.model_dump(exclude_unset=True).items():
        setattr(doctor, key, val)

    db.commit()
    db.refresh(doctor)

    from ..websocket_manager import ws_manager
    await ws_manager.broadcast({"type": "DOCTOR_UPDATE", "hospital_id": doctor.hospital_id})

    return doctor


@router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, db: Session = Depends(get_db)):
    doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    h_id = doctor.hospital_id
    db.delete(doctor)
    db.commit()

    from ..websocket_manager import ws_manager
    await ws_manager.broadcast({"type": "DOCTOR_UPDATE", "hospital_id": h_id})

    return {"message": "Doctor deleted successfully"}


# ── Hospital Details (full view with departments) ──────────────────────────────

@router.get("/{hospital_id}/details", response_model=schemas.HospitalDetailsResponse)
def get_hospital_details(hospital_id: str, db: Session = Depends(get_db)):
    hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    bed_res = db.query(models.Resource).filter(
        models.Resource.hospital_id == hospital_id,
        models.Resource.resource_type == "bed"
    ).first()
    icu_res = db.query(models.Resource).filter(
        models.Resource.hospital_id == hospital_id,
        models.Resource.resource_type == "icu"
    ).first()
    ambulance_res = db.query(models.Resource).filter(
        models.Resource.hospital_id == hospital_id,
        models.Resource.resource_type == "equipment"
    ).first()

    total_beds = bed_res.total if bed_res else 0
    available_beds = bed_res.available if bed_res else 0
    total_icu = icu_res.total if icu_res else 0
    available_icu = icu_res.available if icu_res else 0
    ambulance_available = ambulance_res.available if ambulance_res else 0

    doctors = db.query(models.Doctor).filter(models.Doctor.hospital_id == hospital_id).all()

    from ..services.prediction_service import PredictionService

    departments_dict: dict = {}
    total_waiting = 0
    total_wait_time = 0
    active_doctors_count = 0

    for doc in doctors:
        queue = db.query(models.Token).filter(
            models.Token.doctor_id == doc.id,
            models.Token.status.in_(["waiting", "called", "present"])
        ).all()

        patients_waiting = len(queue)
        total_waiting += patients_waiting

        last_token = (
            db.query(func.max(models.Token.token_number))
            .filter(
                models.Token.doctor_id == doc.id,
                func.date(models.Token.created_at) == func.current_date()
            )
            .scalar() or 0
        )
        pred = PredictionService.predict_wait_time(doc.id, last_token + 1, True, db)
        total_wait_time += pred["eta_minutes"]
        active_doctors_count += 1

        if not doc.is_available:
            status_text = "Absent"
        elif patients_waiting > 5:
            status_text = "Busy"
        elif patients_waiting > 0:
            status_text = "Active Queue"
        else:
            status_text = "Available"

        doc_detail = schemas.DoctorDetail(
            id=doc.id,
            name=doc.name,
            department=doc.department,
            is_available=doc.is_available,
            avg_consult_minutes=doc.avg_consult_minutes,
            experience_years=doc.experience_years,
            specialization=doc.specialization or doc.department,
            photo_url=doc.photo_url or f"https://api.dicebear.com/7.x/adventurer/svg?seed={doc.name.replace(' ', '')}",
            patients_waiting=patients_waiting,
            est_wait_time=pred["eta_minutes"],
            confidence=pred["confidence"],
            patients_ahead=pred["patients_ahead"],
            current_token=pred["current_token"],
            status_text=status_text,
        )

        departments_dict.setdefault(doc.department, []).append(doc_detail)

    avg_wait = int(total_wait_time / active_doctors_count) if active_doctors_count > 0 else 0
    crowd = _get_crowd_level(total_waiting)

    # Services derived from actual departments present in this hospital
    services = list(departments_dict.keys())

    departments_list = [
        schemas.DepartmentDetail(name=dept, doctors=docs)
        for dept, docs in departments_dict.items()
    ]

    return schemas.HospitalDetailsResponse(
        id=hospital.id,
        name=hospital.name,
        address=hospital.address,
        phone=hospital.phone,
        latitude=float(hospital.latitude) if hospital.latitude else None,
        longitude=float(hospital.longitude) if hospital.longitude else None,
        crowd_level=crowd,
        avg_wait_time=avg_wait,
        available_beds=available_beds,
        total_beds=total_beds,
        available_icu=available_icu,
        total_icu=total_icu,
        ambulance_available=ambulance_available,
        services=services,
        departments=departments_list,
    )


# ── Analytics ──────────────────────────────────────────────────────────────────

@router.get("/{hospital_id}/analytics")
def get_hospital_analytics(hospital_id: str, db: Session = Depends(get_db)):
    # 1. Triage urgency distribution from actual triage logs
    triage_logs = (
        db.query(models.TriageLog.urgency, func.count(models.TriageLog.id))
        .group_by(models.TriageLog.urgency)
        .all()
    )
    total_triage = sum(r[1] for r in triage_logs) or 1

    color_map = {
        "emergency": "#ef4444",
        "high": "#f97316",
        "medium": "#eab308",
        "low": "#10b981",
    }
    name_map = {
        "emergency": "Emergency",
        "high": "High Urgency",
        "medium": "Medium Urgency",
        "low": "Low Urgency",
    }

    triage_data = [
        {
            "name": name_map.get(str(urgency).lower(), "Low Urgency"),
            "value": int((count / total_triage) * 100),
            "color": color_map.get(str(urgency).lower(), "#10b981"),
        }
        for urgency, count in triage_logs
    ]

    if not triage_data:
        triage_data = [{"name": "Low Urgency", "value": 100, "color": "#10b981"}]

    # 2. Hourly wait times from actual tokens created today
    hours = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]
    hourly_data = []
    for h in hours:
        h_int = int(h.split(":")[0])
        count = db.query(models.Token).filter(
            func.strftime("%H", models.Token.created_at) == f"{h_int:02d}",
            func.date(models.Token.created_at) == func.current_date()
        ).count()
        hourly_data.append({"hour": h, "waitMinutes": max(5, count * 10)})

    return {
        "triage_distribution": triage_data,
        "hourly_wait_times": hourly_data,
    }

