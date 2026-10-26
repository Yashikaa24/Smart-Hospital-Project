from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..services import ai_service

router = APIRouter()

@router.post("/symptoms", response_model=schemas.TriageResponse)
async def assess_symptoms(request: schemas.TriageRequest, db: Session = Depends(get_db)):
    result = await ai_service.triage_symptoms(request.symptoms)
    
    # Log triage
    log = models.TriageLog(
        symptoms=request.symptoms,
        department=result.get("department"),
        urgency=result.get("urgency"),
        reason=result.get("reason")
    )
    db.add(log)
    db.commit()
    
    return result
