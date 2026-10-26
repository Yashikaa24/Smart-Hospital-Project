from sqlalchemy import Column, String, Text, Integer, Boolean, Enum, Numeric, TIMESTAMP, ForeignKey, Date, Time, func
from sqlalchemy.orm import relationship
from .database import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

# ── Hospital ───────────────────────────────────────────────────────────────────
class Hospital(Base):
    __tablename__ = "hospitals"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    address = Column(Text)
    phone = Column(String(20))
    latitude = Column(Numeric(10, 8))
    longitude = Column(Numeric(11, 8))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    resources = relationship("Resource", back_populates="hospital", cascade="all, delete-orphan")
    doctors = relationship("Doctor", back_populates="hospital", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="hospital", cascade="all, delete-orphan")
    ambulances = relationship("Ambulance", back_populates="hospital", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="hospital", cascade="all, delete-orphan")

# ── Department ─────────────────────────────────────────────────────────────────
class Department(Base):
    __tablename__ = "departments"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    hospital_id = Column(String(36), ForeignKey("hospitals.id"))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    hospital = relationship("Hospital", back_populates="departments")

# ── Resource ───────────────────────────────────────────────────────────────────
class Resource(Base):
    __tablename__ = "resources"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    hospital_id = Column(String(36), ForeignKey("hospitals.id"))
    resource_type = Column(Enum('bed', 'icu', 'ventilator', 'ot', 'equipment'))
    total = Column(Integer, nullable=False)
    available = Column(Integer, nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    hospital = relationship("Hospital", back_populates="resources")

# ── Doctor ─────────────────────────────────────────────────────────────────────
class Doctor(Base):
    __tablename__ = "doctors"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    hospital_id = Column(String(36), ForeignKey("hospitals.id"))
    name = Column(String(255), nullable=False)
    department = Column(String(100))
    is_available = Column(Boolean, default=True)
    avg_consult_minutes = Column(Integer, default=10)
    experience_years = Column(Integer, default=5)
    specialization = Column(String(255))
    photo_url = Column(String(500))
    qr_code_url = Column(String(500), nullable=True)

    hospital = relationship("Hospital", back_populates="doctors")
    tokens = relationship("Token", back_populates="doctor", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="doctor", cascade="all, delete-orphan")

# ── Patient ────────────────────────────────────────────────────────────────────
class Patient(Base):
    __tablename__ = "patients"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    phone = Column(String(20))
    email = Column(String(255))
    health_id = Column(String(50), unique=True, nullable=True)
    date_of_birth = Column(String(10))
    gender = Column(Enum('male', 'female', 'other'))
    address = Column(Text)
    medical_history = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")

# ── Token (Queue) ──────────────────────────────────────────────────────────────
class Token(Base):
    __tablename__ = "tokens"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    doctor_id = Column(String(36), ForeignKey("doctors.id"))
    patient_name = Column(String(255), nullable=False)
    phone = Column(String(20))
    token_number = Column(Integer, nullable=False)
    status = Column(Enum('waiting', 'called', 'present', 'completed', 'cancelled'), default='waiting')
    location_lat = Column(Numeric(10, 8))
    location_lng = Column(Numeric(11, 8))
    called_at = Column(TIMESTAMP, nullable=True)
    is_half = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    doctor = relationship("Doctor", back_populates="tokens")

# ── Appointment ────────────────────────────────────────────────────────────────
class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id"))
    doctor_id = Column(String(36), ForeignKey("doctors.id"))
    hospital_id = Column(String(36), ForeignKey("hospitals.id"))
    department = Column(String(100))
    date = Column(String(10))  # YYYY-MM-DD
    time = Column(String(5))   # HH:MM
    status = Column(Enum('scheduled', 'completed', 'cancelled'), default='scheduled')
    notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")

# ── Ambulance ──────────────────────────────────────────────────────────────────
class Ambulance(Base):
    __tablename__ = "ambulances"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    hospital_id = Column(String(36), ForeignKey("hospitals.id"))
    driver_name = Column(String(255), nullable=False)
    vehicle_number = Column(String(50), nullable=False)
    current_lat = Column(Numeric(10, 8))
    current_lng = Column(Numeric(11, 8))
    is_available = Column(Boolean, default=True)
    eta_minutes = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    hospital = relationship("Hospital", back_populates="ambulances")

# ── Notification ───────────────────────────────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    hospital_id = Column(String(36), ForeignKey("hospitals.id"))
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(Enum('info', 'warning', 'critical'), default='info')
    is_read = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    hospital = relationship("Hospital", back_populates="notifications")

# ── Triage Log ─────────────────────────────────────────────────────────────────
class TriageLog(Base):
    __tablename__ = "triage_logs"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    symptoms = Column(Text, nullable=False)
    department = Column(String(100))
    urgency = Column(Enum('low', 'medium', 'high', 'emergency'))
    reason = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

# ── User (kept for data integrity, login flow removed) ─────────────────────────
class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255))
    avatar_url = Column(String(500))
    role = Column(Enum('doctor', 'management', 'patient'), default='patient')
    doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    doctor = relationship("Doctor")
