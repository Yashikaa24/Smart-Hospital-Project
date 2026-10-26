from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..websocket_manager import ws_manager
from typing import List

router = APIRouter()

@router.get("/hospitals/{hospital_id}/ambulances", response_model=List[schemas.AmbulanceResponse])
def get_hospital_ambulances(hospital_id: str, db: Session = Depends(get_db)):
    hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return db.query(models.Ambulance).filter(models.Ambulance.hospital_id == hospital_id).all()

@router.post("/hospitals/{hospital_id}/ambulances", response_model=schemas.AmbulanceResponse)
async def create_ambulance(hospital_id: str, ambulance: schemas.AmbulanceCreate, db: Session = Depends(get_db)):
    hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    db_amb = models.Ambulance(**ambulance.model_dump(), hospital_id=hospital_id)
    db.add(db_amb)
    db.commit()
    db.refresh(db_amb)
    
    # Broadcast update
    await ws_manager.broadcast({"type": "AMBULANCE_UPDATE", "hospital_id": hospital_id})
    return db_amb

@router.patch("/ambulances/{ambulance_id}", response_model=schemas.AmbulanceResponse)
async def update_ambulance(ambulance_id: str, update: schemas.AmbulanceCreate, db: Session = Depends(get_db)):
    amb = db.query(models.Ambulance).filter(models.Ambulance.id == ambulance_id).first()
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")
        
    for key, val in update.model_dump(exclude_unset=True).items():
        setattr(amb, key, val)
        
    db.commit()
    db.refresh(amb)
    
    # Broadcast update
    await ws_manager.broadcast({"type": "AMBULANCE_UPDATE", "hospital_id": amb.hospital_id})
    return amb

@router.delete("/ambulances/{ambulance_id}")
async def delete_ambulance(ambulance_id: str, db: Session = Depends(get_db)):
    amb = db.query(models.Ambulance).filter(models.Ambulance.id == ambulance_id).first()
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")
        
    h_id = amb.hospital_id
    db.delete(amb)
    db.commit()
    
    # Broadcast update
    await ws_manager.broadcast({"type": "AMBULANCE_UPDATE", "hospital_id": h_id})
    return {"message": "Ambulance deleted successfully"}
