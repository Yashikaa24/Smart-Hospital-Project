from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from typing import List, Optional

router = APIRouter()

def _build_appointment_response(appt, db: Session) -> schemas.AppointmentResponse:
    patient = db.query(models.Patient).filter(models.Patient.id == appt.patient_id).first()
    doctor = db.query(models.Doctor).filter(models.Doctor.id == appt.doctor_id).first()
    hospital = db.query(models.Hospital).filter(models.Hospital.id == appt.hospital_id).first()
    
    return schemas.AppointmentResponse(
        id=appt.id,
        patient_id=appt.patient_id,
        doctor_id=appt.doctor_id,
        hospital_id=appt.hospital_id,
        department=appt.department,
        date=appt.date,
        time=appt.time,
        status=appt.status,
        notes=appt.notes,
        created_at=appt.created_at,
        patient_name=patient.name if patient else "Unknown Patient",
        doctor_name=doctor.name if doctor else "Unknown Doctor",
        hospital_name=hospital.name if hospital else "Unknown Hospital"
    )

@router.post("/", response_model=schemas.AppointmentResponse)
def create_appointment(appt: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    # Verify patient, doctor, hospital
    patient = db.query(models.Patient).filter(models.Patient.id == appt.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    doctor = db.query(models.Doctor).filter(models.Doctor.id == appt.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    hospital = db.query(models.Hospital).filter(models.Hospital.id == appt.hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    db_appt = models.Appointment(**appt.model_dump())
    db.add(db_appt)
    db.commit()
    db.refresh(db_appt)
    return _build_appointment_response(db_appt, db)

@router.get("/", response_model=List[schemas.AppointmentResponse])
def get_appointments(
    hospital_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Appointment)
    if hospital_id:
        query = query.filter(models.Appointment.hospital_id == hospital_id)
    if doctor_id:
        query = query.filter(models.Appointment.doctor_id == doctor_id)
    if patient_id:
        query = query.filter(models.Appointment.patient_id == patient_id)
        
    appts = query.all()
    return [_build_appointment_response(a, db) for a in appts]

@router.get("/{appt_id}", response_model=schemas.AppointmentResponse)
def get_appointment(appt_id: str, db: Session = Depends(get_db)):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return _build_appointment_response(appt, db)

@router.patch("/{appt_id}", response_model=schemas.AppointmentResponse)
def update_appointment(appt_id: str, update: schemas.AppointmentBase, db: Session = Depends(get_db)):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    for key, val in update.model_dump(exclude_unset=True).items():
        setattr(appt, key, val)
        
    db.commit()
    db.refresh(appt)
    return _build_appointment_response(appt, db)

@router.delete("/{appt_id}")
def delete_appointment(appt_id: str, db: Session = Depends(get_db)):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    db.delete(appt)
    db.commit()
    return {"message": "Appointment deleted successfully"}
