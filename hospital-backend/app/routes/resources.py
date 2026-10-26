from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..websocket_manager import ws_manager
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()

class ResourceUpdateSchema(BaseModel):
    total: Optional[int] = None
    available: Optional[int] = None

@router.get("/{hospital_id}", response_model=List[schemas.Resource])
def get_resources(hospital_id: str, db: Session = Depends(get_db)):
    return db.query(models.Resource).filter(models.Resource.hospital_id == hospital_id).all()

@router.patch("/{resource_id}", response_model=schemas.Resource)
async def update_resource(resource_id: str, update: ResourceUpdateSchema, db: Session = Depends(get_db)):
    resource = db.query(models.Resource).filter(models.Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    if update.total is not None:
        resource.total = update.total
    if update.available is not None:
        if update.available > resource.total:
            raise HTTPException(status_code=400, detail="Available cannot exceed total")
        resource.available = update.available
        
    db.commit()
    db.refresh(resource)
    
    # Broadcast update to all connected clients
    await ws_manager.broadcast({"type": "RESOURCE_UPDATE", "hospital_id": resource.hospital_id})
    
    return resource

@router.post("/{hospital_id}", response_model=schemas.Resource)
async def create_resource(hospital_id: str, resource: schemas.ResourceBase, db: Session = Depends(get_db)):
    db_resource = models.Resource(**resource.model_dump(), hospital_id=hospital_id)
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    
    # Broadcast update
    await ws_manager.broadcast({"type": "RESOURCE_UPDATE", "hospital_id": hospital_id})
    
    return db_resource

@router.delete("/{resource_id}")
async def delete_resource(resource_id: str, db: Session = Depends(get_db)):
    resource = db.query(models.Resource).filter(models.Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    h_id = resource.hospital_id
    db.delete(resource)
    db.commit()
    
    # Broadcast update
    await ws_manager.broadcast({"type": "RESOURCE_UPDATE", "hospital_id": h_id})
    
    return {"message": "Resource deleted successfully"}
