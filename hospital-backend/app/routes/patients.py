from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from typing import List, Optional

router = APIRouter()

@router.post("/", response_model=schemas.PatientResponse)
def create_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db)):
    # Check if health_id already exists
    if patient.health_id:
        existing = db.query(models.Patient).filter(models.Patient.health_id == patient.health_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Patient with this Health ID already exists")
    
    db_patient = models.Patient(**patient.model_dump())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@router.get("/", response_model=List[schemas.PatientResponse])
def get_patients(q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Patient)
    if q:
        query = query.filter(
            (models.Patient.name.like(f"%{q}%")) | 
            (models.Patient.phone.like(f"%{q}%")) | 
            (models.Patient.health_id.like(f"%{q}%"))
        )
    return query.all()

@router.get("/{patient_id}", response_model=schemas.PatientResponse)
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@router.patch("/{patient_id}", response_model=schemas.PatientResponse)
def update_patient(patient_id: str, update: schemas.PatientCreate, db: Session = Depends(get_db)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    for key, val in update.model_dump(exclude_unset=True).items():
        setattr(patient, key, val)
        
    db.commit()
    db.refresh(patient)
    return patient

@router.delete("/{patient_id}")
def delete_patient(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    db.delete(patient)
    db.commit()
    return {"message": "Patient deleted successfully"}
