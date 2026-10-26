from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..websocket_manager import ws_manager
from typing import List

router = APIRouter()

@router.get("/hospitals/{hospital_id}/notifications", response_model=List[schemas.NotificationResponse])
def get_notifications(hospital_id: str, db: Session = Depends(get_db)):
    hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return db.query(models.Notification).filter(models.Notification.hospital_id == hospital_id).all()

@router.post("/hospitals/{hospital_id}/notifications", response_model=schemas.NotificationResponse)
async def create_notification(hospital_id: str, notif: schemas.NotificationCreate, db: Session = Depends(get_db)):
    hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    db_notif = models.Notification(**notif.model_dump(), hospital_id=hospital_id)
    db.add(db_notif)
    db.commit()
    db.refresh(db_notif)
    
    # Broadcast update
    await ws_manager.broadcast({"type": "NOTIFICATION_UPDATE", "hospital_id": hospital_id})
    return db_notif

@router.patch("/notifications/{notification_id}/read", response_model=schemas.NotificationResponse)
async def mark_as_read(notification_id: str, db: Session = Depends(get_db)):
    notif = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    
    # Broadcast update
    await ws_manager.broadcast({"type": "NOTIFICATION_UPDATE", "hospital_id": notif.hospital_id})
    return notif

@router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, db: Session = Depends(get_db)):
    notif = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    h_id = notif.hospital_id
    db.delete(notif)
    db.commit()
    
    # Broadcast update
    await ws_manager.broadcast({"type": "NOTIFICATION_UPDATE", "hospital_id": h_id})
    return {"message": "Notification deleted successfully"}
