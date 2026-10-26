from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

# ── Hospital ───────────────────────────────────────────────────────────────────
class HospitalBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class HospitalCreate(HospitalBase):
    pass

class Hospital(HospitalBase):
    id: str
    created_at: datetime
    crowd_level: Optional[str] = "Low"
    available_beds: Optional[int] = 0
    icu_beds: Optional[int] = 0
    est_wait_time: Optional[int] = 0
    status: Optional[str] = "Open"
    distance: Optional[str] = None
    class Config:
        from_attributes = True

# ── Resource ───────────────────────────────────────────────────────────────────
class ResourceBase(BaseModel):
    resource_type: str
    total: int
    available: int

class ResourceUpdate(BaseModel):
    available: int

class Resource(ResourceBase):
    id: str
    hospital_id: str
    updated_at: datetime
    class Config:
        from_attributes = True

# ── Doctor ─────────────────────────────────────────────────────────────────────
class DoctorBase(BaseModel):
    name: str
    department: str
    is_available: Optional[bool] = True
    avg_consult_minutes: Optional[int] = 10
    experience_years: Optional[int] = 5
    specialization: Optional[str] = None
    photo_url: Optional[str] = None
    qr_code_url: Optional[str] = None

class DoctorCreate(DoctorBase):
    hospital_id: str

class Doctor(DoctorBase):
    id: str
    hospital_id: str
    class Config:
        from_attributes = True

# ── Token (Queue) ──────────────────────────────────────────────────────────────
class TokenBase(BaseModel):
    patient_name: str
    phone: str

class TokenCreate(TokenBase):
    doctor_id: str
    is_half: Optional[bool] = False

class TokenLocationUpdate(BaseModel):
    lat: Decimal
    lng: Decimal

class Token(TokenBase):
    id: str
    doctor_id: str
    token_number: int
    status: str
    location_lat: Optional[Decimal] = None
    location_lng: Optional[Decimal] = None
    called_at: Optional[datetime] = None
    is_half: Optional[bool] = False
    eta_minutes: Optional[int] = None
    patients_ahead: Optional[int] = None
    current_token: Optional[int] = None
    confidence: Optional[int] = None
    hospital_lat: Optional[float] = None
    hospital_lng: Optional[float] = None
    created_at: datetime
    class Config:
        from_attributes = True

class TokenStatusUpdate(BaseModel):
    status: str

# ── Department ─────────────────────────────────────────────────────────────────
class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: str
    hospital_id: str
    created_at: datetime
    class Config:
        from_attributes = True

# ── Patient ────────────────────────────────────────────────────────────────────
class PatientBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    health_id: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    medical_history: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientResponse(PatientBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True

# ── Appointment ────────────────────────────────────────────────────────────────
class AppointmentBase(BaseModel):
    patient_id: str
    doctor_id: str
    hospital_id: str
    department: Optional[str] = None
    date: str
    time: str
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentResponse(AppointmentBase):
    id: str
    created_at: datetime
    # Joined fields for display
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    class Config:
        from_attributes = True

# ── Ambulance ──────────────────────────────────────────────────────────────────
class AmbulanceBase(BaseModel):
    driver_name: str
    vehicle_number: str
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    is_available: Optional[bool] = True
    eta_minutes: Optional[int] = 0

class AmbulanceCreate(AmbulanceBase):
    pass

class AmbulanceResponse(AmbulanceBase):
    id: str
    hospital_id: str
    created_at: datetime
    class Config:
        from_attributes = True

# ── Notification ───────────────────────────────────────────────────────────────
class NotificationBase(BaseModel):
    title: str
    message: str
    type: Optional[str] = "info"

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    id: str
    hospital_id: str
    is_read: bool
    created_at: datetime
    class Config:
        from_attributes = True

# ── Triage ─────────────────────────────────────────────────────────────────────
class TriageRequest(BaseModel):
    symptoms: str

class TriageResponse(BaseModel):
    department: str
    urgency: str
    reason: str
    see_doctor_in_minutes: int

# ── Chatbot ────────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    hospital_name: str

# ── Hospital Detail Schemas (for hospital detail view) ─────────────────────────
class DoctorDetail(BaseModel):
    id: str
    name: str
    department: str
    is_available: bool
    avg_consult_minutes: int
    experience_years: int
    specialization: Optional[str] = None
    photo_url: Optional[str] = None
    qr_code_url: Optional[str] = None
    patients_waiting: int
    est_wait_time: int
    confidence: int
    patients_ahead: int
    current_token: int
    status_text: str

class DepartmentDetail(BaseModel):
    name: str
    doctors: List[DoctorDetail]

class HospitalDetailsResponse(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    crowd_level: str
    avg_wait_time: int
    available_beds: int
    total_beds: int
    available_icu: int
    total_icu: int
    ambulance_available: int
    services: List[str] = []
    departments: List[DepartmentDetail] = []
