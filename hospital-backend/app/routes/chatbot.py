from fastapi import APIRouter
from .. import schemas
from ..services import ai_service

router = APIRouter()

@router.post("/chat")
async def chat(request: schemas.ChatRequest):
    # Convert ChatMessage objects to dicts
    messages = [msg.model_dump() for msg in request.messages]
    reply = await ai_service.chat_with_patient(messages, request.hospital_name)
    return {"reply": reply}
