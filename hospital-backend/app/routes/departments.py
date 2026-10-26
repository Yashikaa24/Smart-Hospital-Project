from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from typing import List

router = APIRouter()

@router.get("/hospitals/{hospital_id}/departments", response_model=List[schemas.DepartmentResponse])
def get_hospital_departments(hospital_id: str, db: Session = Depends(get_db)):
    # Verify hospital exists
    hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return db.query(models.Department).filter(models.Department.hospital_id == hospital_id).all()

@router.post("/hospitals/{hospital_id}/departments", response_model=schemas.DepartmentResponse)
def create_hospital_department(hospital_id: str, department: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    
    # Check if department with same name already exists in hospital
    existing = db.query(models.Department).filter(
        models.Department.hospital_id == hospital_id,
        models.Department.name == department.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department with this name already exists in the hospital")
        
    db_dept = models.Department(**department.model_dump(), hospital_id=hospital_id)
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    return db_dept

@router.patch("/departments/{department_id}", response_model=schemas.DepartmentResponse)
def update_department(department_id: str, update: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    for key, val in update.model_dump(exclude_unset=True).items():
        setattr(dept, key, val)
        
    db.commit()
    db.refresh(dept)
    return dept

@router.delete("/departments/{department_id}")
def delete_department(department_id: str, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    db.delete(dept)
    db.commit()
    return {"message": "Department deleted successfully"}
