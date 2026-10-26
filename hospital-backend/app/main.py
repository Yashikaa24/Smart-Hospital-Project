import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routes import tokens, resources, hospitals, chatbot, triage, patients, departments, appointments, ambulances, notifications
from .websocket_manager import ws_manager
from .init_db import init_db
from apscheduler.schedulers.background import BackgroundScheduler
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────────────────────────
    # Ensure all tables exist and seed default data if the DB is empty
    init_db()

    # Start APScheduler for token auto-cancel tasks
    scheduler = BackgroundScheduler()
    scheduler.start()
    app.state.scheduler = scheduler

    yield

    # ── Shutdown ───────────────────────────────────────────────────────────────
    scheduler.shutdown()


app = FastAPI(title="SmartH API", lifespan=lifespan)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Read allowed origins from env; default to "*" for local development
_raw_origins = os.getenv("CORS_ORIGINS", "*")
cors_origins = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────────────────
app.include_router(tokens.router,      prefix="/tokens",    tags=["Tokens"])
app.include_router(resources.router,   prefix="/resources", tags=["Resources"])
app.include_router(hospitals.router,   prefix="/hospitals", tags=["Hospitals"])
app.include_router(chatbot.router,     prefix="/chatbot",   tags=["Chatbot"])
app.include_router(triage.router,      prefix="/triage",    tags=["Triage"])
app.include_router(patients.router,    prefix="/patients",  tags=["Patients"])
app.include_router(departments.router, prefix="",           tags=["Departments"])
app.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
app.include_router(ambulances.router,  prefix="",           tags=["Ambulances"])
app.include_router(notifications.router, prefix="",          tags=["Notifications"])


# ── WebSocket ──────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Simple heartbeat echo
            await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


@app.get("/")
async def root():
    return {"message": "Welcome to the SmartH API"}
