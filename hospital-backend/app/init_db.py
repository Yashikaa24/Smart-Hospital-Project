import io
import json
import qrcode
import base64
from .database import engine, Base, SessionLocal
from . import models


def generate_qr_png_bytes(data: dict) -> bytes:
    """Generate a QR code PNG as raw bytes from a dict payload."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=4,
    )
    qr.add_data(json.dumps(data, separators=(',', ':')))
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


def generate_qr_data_url(data: dict) -> str:
    """Generate a base64 data URL for embedding in HTML."""
    png_bytes = generate_qr_png_bytes(data)
    b64 = base64.b64encode(png_bytes).decode('utf-8')
    return f"data:image/png;base64,{b64}"


def init_db():
    """
    Create all database tables if they do not exist.
    Does NOT drop existing tables — safe to run on every startup.
    Then seeds default hospital, resource, doctor, department, patient, ambulance, notification, and appointment data.
    """
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables ensured.")
        seed_db()
    except Exception as e:
        print(f"Error initialising database: {e}")


def seed_db():
    """Seed baseline data only if the DB is empty or has fewer than 5 hospitals."""
    db = SessionLocal()
    try:
        existing_hospitals = db.query(models.Hospital).count()
        if existing_hospitals >= 5:
            print(f"Database already has {existing_hospitals} hospitals — skipping seed.")
            # Still ensure QR codes are generated for all doctors
            _ensure_qr_codes(db)
            return

        print("Seeding default hospital data...")

        # ── Hospitals ───────────────────────────────────────────────────────────
        hospitals_data = [
            models.Hospital(
                id="h1",
                name="Bombay Hospital Indore",
                address="Ring Road, Indore, Madhya Pradesh 452010",
                phone="0731-404-0405",
                latitude=22.7213,
                longitude=75.8897,
            ),
            models.Hospital(
                id="h2",
                name="Choithram Hospital & Research Centre",
                address="Manik Bagh Road, Indore, Madhya Pradesh 452014",
                phone="0731-404-0000",
                latitude=22.6916,
                longitude=75.8656,
            ),
            models.Hospital(
                id="h3",
                name="CHL Apollo Hospital",
                address="A.B. Road, Indore, Madhya Pradesh 452008",
                phone="0731-489-2222",
                latitude=22.7139,
                longitude=75.8576,
            ),
            models.Hospital(
                id="h4",
                name="Medanta Hospital Indore",
                address="Scheme No. 54, Vijay Nagar, Indore, Madhya Pradesh 452010",
                phone="0731-498-0000",
                latitude=22.7527,
                longitude=75.9005,
            ),
            models.Hospital(
                id="h5",
                name="Care CHL Hospital",
                address="LIG Square, A.B. Road, Indore, Madhya Pradesh 452008",
                phone="0731-407-7777",
                latitude=22.7215,
                longitude=75.8620,
            ),
        ]

        for h in hospitals_data:
            existing = db.query(models.Hospital).filter(models.Hospital.id == h.id).first()
            if not existing:
                db.add(h)
        db.commit()

        # ── Resources ──────────────────────────────────────────────────────────
        resources = [
            # Bombay Hospital (h1)
            models.Resource(hospital_id="h1", resource_type="bed", total=100, available=42),
            models.Resource(hospital_id="h1", resource_type="icu", total=20, available=3),
            models.Resource(hospital_id="h1", resource_type="ventilator", total=15, available=8),
            models.Resource(hospital_id="h1", resource_type="ot", total=5, available=1),
            # Choithram Hospital (h2)
            models.Resource(hospital_id="h2", resource_type="bed", total=50, available=12),
            models.Resource(hospital_id="h2", resource_type="icu", total=5, available=0),
            models.Resource(hospital_id="h2", resource_type="ventilator", total=8, available=2),
            models.Resource(hospital_id="h2", resource_type="ot", total=2, available=0),
            # CHL Apollo Hospital (h3)
            models.Resource(hospital_id="h3", resource_type="bed", total=150, available=85),
            models.Resource(hospital_id="h3", resource_type="icu", total=30, available=15),
            models.Resource(hospital_id="h3", resource_type="ventilator", total=25, available=12),
            models.Resource(hospital_id="h3", resource_type="ot", total=8, available=3),
            # Medanta Hospital (h4)
            models.Resource(hospital_id="h4", resource_type="bed", total=200, available=120),
            models.Resource(hospital_id="h4", resource_type="icu", total=40, available=22),
            models.Resource(hospital_id="h4", resource_type="ventilator", total=30, available=18),
            models.Resource(hospital_id="h4", resource_type="ot", total=10, available=5),
            # Care CHL Hospital (h5)
            models.Resource(hospital_id="h5", resource_type="bed", total=80, available=35),
            models.Resource(hospital_id="h5", resource_type="icu", total=15, available=7),
            models.Resource(hospital_id="h5", resource_type="ventilator", total=12, available=5),
            models.Resource(hospital_id="h5", resource_type="ot", total=4, available=2),
        ]

        for r in resources:
            existing_r = db.query(models.Resource).filter(
                models.Resource.hospital_id == r.hospital_id,
                models.Resource.resource_type == r.resource_type
            ).first()
            if not existing_r:
                db.add(r)
        db.commit()

        # ── Doctors ────────────────────────────────────────────────────────────
        doctors = [
            # Bombay Hospital (h1)
            models.Doctor(id="doc-123", hospital_id="h1", name="Dr. Sarah Smith",     department="General OPD",  is_available=True,  avg_consult_minutes=10, experience_years=8,  specialization="General OPD Care",              photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=SarahSmith"),
            models.Doctor(id="doc-456", hospital_id="h1", name="Dr. James Watson",    department="Cardiology",   is_available=True,  avg_consult_minutes=20, experience_years=15, specialization="Interventional Cardiology",      photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=JamesWatson"),
            models.Doctor(id="doc-101", hospital_id="h1", name="Dr. Clara Oswald",    department="Sonography",   is_available=True,  avg_consult_minutes=15, experience_years=6,  specialization="Obstetric Sonography",           photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=ClaraOswald"),
            models.Doctor(id="doc-102", hospital_id="h1", name="Dr. Robert Chen",     department="Emergency",    is_available=True,  avg_consult_minutes=8,  experience_years=12, specialization="Trauma & Emergency Care",         photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=RobertChen"),
            models.Doctor(id="doc-103", hospital_id="h1", name="Dr. David Tennant",   department="Neurology",    is_available=True,  avg_consult_minutes=25, experience_years=18, specialization="Clinical Neurology",             photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=DavidTennant"),
            models.Doctor(id="doc-104", hospital_id="h1", name="Dr. Martha Jones",    department="Orthopedics",  is_available=True,  avg_consult_minutes=15, experience_years=9,  specialization="Joint Replacement",              photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=MarthaJones"),
            models.Doctor(id="doc-105", hospital_id="h1", name="Dr. Donna Noble",     department="Radiology",    is_available=True,  avg_consult_minutes=10, experience_years=7,  specialization="Diagnostic Imaging",             photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=DonnaNoble"),
            # Choithram Hospital (h2)
            models.Doctor(id="doc-789", hospital_id="h2", name="Dr. Elena Rostova",   department="General OPD",  is_available=True,  avg_consult_minutes=10, experience_years=5,  specialization="Family Medicine",                photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=ElenaRostova"),
            models.Doctor(id="doc-201", hospital_id="h2", name="Dr. John Carter",     department="Emergency",    is_available=True,  avg_consult_minutes=12, experience_years=10, specialization="Emergency Medicine",              photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=JohnCarter"),
            models.Doctor(id="doc-202", hospital_id="h2", name="Dr. Gregory House",   department="Neurology",    is_available=True,  avg_consult_minutes=25, experience_years=22, specialization="Diagnostic Pathology & Neurology",photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=GregoryHouse"),
            models.Doctor(id="doc-203", hospital_id="h2", name="Dr. Lisa Cuddy",      department="Orthopedics",  is_available=True,  avg_consult_minutes=15, experience_years=14, specialization="Pediatric Orthopedics",          photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=LisaCuddy"),
            models.Doctor(id="doc-204", hospital_id="h2", name="Dr. Eric Foreman",    department="Sonography",   is_available=True,  avg_consult_minutes=12, experience_years=11, specialization="Abdominal Ultrasound",           photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=EricForeman"),
            models.Doctor(id="doc-205", hospital_id="h2", name="Dr. Allison Cameron", department="Cardiology",   is_available=True,  avg_consult_minutes=18, experience_years=9,  specialization="Cardiac Rehabilitation",         photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=AllisonCameron"),
            models.Doctor(id="doc-206", hospital_id="h2", name="Dr. Robert Chase",    department="Radiology",    is_available=True,  avg_consult_minutes=10, experience_years=8,  specialization="Interventional Radiology",       photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=RobertChase"),
            # CHL Apollo Hospital (h3)
            models.Doctor(id="doc-301", hospital_id="h3", name="Dr. Meredith Grey",   department="General OPD",  is_available=True,  avg_consult_minutes=15, experience_years=12, specialization="General Surgery & OPD",          photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=MeredithGrey"),
            models.Doctor(id="doc-302", hospital_id="h3", name="Dr. Derek Shepherd",  department="Neurology",    is_available=True,  avg_consult_minutes=20, experience_years=20, specialization="Neurosurgery",                   photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=DerekShepherd"),
            models.Doctor(id="doc-303", hospital_id="h3", name="Dr. Cristina Yang",   department="Cardiology",   is_available=True,  avg_consult_minutes=15, experience_years=11, specialization="Thoracic Surgery & Cardiology",  photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=CristinaYang"),
            models.Doctor(id="doc-304", hospital_id="h3", name="Dr. Miranda Bailey",  department="Emergency",    is_available=True,  avg_consult_minutes=10, experience_years=16, specialization="Acute Emergency Care",            photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=MirandaBailey"),
            models.Doctor(id="doc-305", hospital_id="h3", name="Dr. Alex Karev",      department="Sonography",   is_available=True,  avg_consult_minutes=12, experience_years=8,  specialization="Pediatric Ultrasound",           photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=AlexKarev"),
            models.Doctor(id="doc-306", hospital_id="h3", name="Dr. Callie Torres",   department="Orthopedics",  is_available=True,  avg_consult_minutes=14, experience_years=13, specialization="Orthopedic Trauma",              photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=CallieTorres"),
            models.Doctor(id="doc-307", hospital_id="h3", name="Dr. Jackson Avery",   department="Radiology",    is_available=True,  avg_consult_minutes=10, experience_years=9,  specialization="Diagnostic Imaging",             photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=JacksonAvery"),
            # Medanta Hospital (h4)
            models.Doctor(id="doc-401", hospital_id="h4", name="Dr. Priya Sharma",    department="Cardiology",   is_available=True,  avg_consult_minutes=20, experience_years=14, specialization="Preventive Cardiology",          photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=PriyaSharma"),
            models.Doctor(id="doc-402", hospital_id="h4", name="Dr. Rajan Mehta",     department="Neurology",    is_available=True,  avg_consult_minutes=25, experience_years=17, specialization="Epilepsy & Movement Disorders",  photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=RajanMehta"),
            models.Doctor(id="doc-403", hospital_id="h4", name="Dr. Sunita Patel",    department="Sonography",   is_available=True,  avg_consult_minutes=12, experience_years=9,  specialization="Fetal Medicine",                 photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=SunitaPatel"),
            models.Doctor(id="doc-404", hospital_id="h4", name="Dr. Vikram Nair",     department="Orthopedics",  is_available=True,  avg_consult_minutes=15, experience_years=11, specialization="Sports Medicine",                photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=VikramNair"),
            models.Doctor(id="doc-405", hospital_id="h4", name="Dr. Anita Gupta",     department="General OPD",  is_available=True,  avg_consult_minutes=10, experience_years=6,  specialization="Internal Medicine",              photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=AnitaGupta"),
            models.Doctor(id="doc-406", hospital_id="h4", name="Dr. Deepak Singh",    department="Emergency",    is_available=True,  avg_consult_minutes=8,  experience_years=13, specialization="Critical Care",                  photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=DeepakSingh"),
            # Care CHL Hospital (h5)
            models.Doctor(id="doc-501", hospital_id="h5", name="Dr. Kavya Reddy",     department="General OPD",  is_available=True,  avg_consult_minutes=12, experience_years=7,  specialization="Preventive Medicine",            photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=KavyaReddy"),
            models.Doctor(id="doc-502", hospital_id="h5", name="Dr. Arun Kumar",      department="Cardiology",   is_available=True,  avg_consult_minutes=18, experience_years=12, specialization="Non-Invasive Cardiology",        photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=ArunKumar"),
            models.Doctor(id="doc-503", hospital_id="h5", name="Dr. Meera Joshi",     department="Radiology",    is_available=True,  avg_consult_minutes=10, experience_years=8,  specialization="CT & MRI Interpretation",        photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=MeeraJoshi"),
            models.Doctor(id="doc-504", hospital_id="h5", name="Dr. Sanjay Dubey",    department="Neurology",    is_available=True,  avg_consult_minutes=22, experience_years=16, specialization="Stroke & Vascular Neurology",    photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=SanjayDubey"),
            models.Doctor(id="doc-505", hospital_id="h5", name="Dr. Neha Agrawal",    department="Sonography",   is_available=True,  avg_consult_minutes=14, experience_years=10, specialization="MSK Ultrasound",                 photo_url="https://api.dicebear.com/7.x/adventurer/svg?seed=NehaAgrawal"),
        ]

        for d in doctors:
            existing_doc = db.query(models.Doctor).filter(models.Doctor.id == d.id).first()
            if not existing_doc:
                db.add(d)
        db.commit()

        # ── Departments ────────────────────────────────────────────────────────
        dept_list = [
            ("General OPD",  "General Outpatient Department for basic medical reviews"),
            ("Cardiology",   "Cardiology care and diagnostics"),
            ("Sonography",   "Imaging and ultrasound diagnosis"),
            ("Emergency",    "Critical care, trauma, and accident response"),
            ("Neurology",    "Brain, spine, and neurological consultations"),
            ("Orthopedics",  "Bone, joint, and orthopedic reviews"),
            ("Radiology",    "X-ray, CT scanning, and medical diagnostics"),
        ]
        for h_id in ["h1", "h2", "h3", "h4", "h5"]:
            for name, desc in dept_list:
                existing_dept = db.query(models.Department).filter(
                    models.Department.hospital_id == h_id,
                    models.Department.name == name
                ).first()
                if not existing_dept:
                    db.add(models.Department(hospital_id=h_id, name=name, description=desc))
        db.commit()

        # ── Patients ───────────────────────────────────────────────────────────
        patients = [
            models.Patient(id="p1", name="John Doe",       phone="9876543210", email="john.doe@example.com",   health_id="NH-12345-6", date_of_birth="1985-05-12", gender="male",   address="Indore, MP", medical_history="No significant past medical history. Seasonal allergies."),
            models.Patient(id="p2", name="Jane Smith",     phone="9876543211", email="jane.smith@example.com", health_id="NH-12345-7", date_of_birth="1990-08-20", gender="female", address="Indore, MP", medical_history="High blood pressure controlled with lifestyle modifications."),
            models.Patient(id="p3", name="Robert Johnson", phone="9876543212", email="robert.j@example.com",   health_id="NH-12345-8", date_of_birth="1978-11-02", gender="male",   address="Indore, MP", medical_history="Diabetes Type 2 diagnosed in 2021. Under regular metformin therapy."),
        ]
        for p in patients:
            existing_p = db.query(models.Patient).filter(models.Patient.id == p.id).first()
            if not existing_p:
                db.add(p)
        db.commit()

        # ── Ambulances ─────────────────────────────────────────────────────────
        ambulances = [
            models.Ambulance(hospital_id="h1", driver_name="Rajesh Kumar", vehicle_number="MP-09-AB-1234", current_lat=22.7210, current_lng=75.8890, is_available=True,  eta_minutes=5),
            models.Ambulance(hospital_id="h1", driver_name="Sunil Sharma", vehicle_number="MP-09-CD-5678", current_lat=22.7230, current_lng=75.8910, is_available=False, eta_minutes=12),
            models.Ambulance(hospital_id="h2", driver_name="Anil Verma",   vehicle_number="MP-09-EF-9012", current_lat=22.6910, current_lng=75.8650, is_available=True,  eta_minutes=3),
            models.Ambulance(hospital_id="h3", driver_name="Vicky Singh",  vehicle_number="MP-09-GH-3456", current_lat=22.7130, current_lng=75.8570, is_available=True,  eta_minutes=8),
            models.Ambulance(hospital_id="h4", driver_name="Mohan Das",    vehicle_number="MP-09-IJ-7890", current_lat=22.7527, current_lng=75.9005, is_available=True,  eta_minutes=6),
            models.Ambulance(hospital_id="h5", driver_name="Kiran Patil",  vehicle_number="MP-09-KL-2345", current_lat=22.7215, current_lng=75.8620, is_available=True,  eta_minutes=4),
        ]
        for amb in ambulances:
            existing_amb = db.query(models.Ambulance).filter(
                models.Ambulance.vehicle_number == amb.vehicle_number
            ).first()
            if not existing_amb:
                db.add(amb)
        db.commit()

        # ── Notifications ──────────────────────────────────────────────────────
        notifications = [
            models.Notification(hospital_id="h1", title="Critical ICU Shortage",  message="Only 3 ICU beds are currently available. Coordinate with other departments.", type="critical", is_read=False),
            models.Notification(hospital_id="h1", title="General Bed Alert",       message="15 new general beds added successfully to Ward C.",                            type="info",     is_read=False),
            models.Notification(hospital_id="h2", title="Staff Update",            message="Dr. Elena Rostova is online and accepting consultations.",                     type="info",     is_read=False),
        ]
        for notif in notifications:
            db.add(notif)
        db.commit()

        # ── Appointments ───────────────────────────────────────────────────────
        appointments = [
            models.Appointment(patient_id="p1", doctor_id="doc-123", hospital_id="h1", department="General OPD", date="2026-07-18", time="10:30", status="scheduled", notes="Routine health checkup. Check blood pressure and heart rate."),
            models.Appointment(patient_id="p2", doctor_id="doc-456", hospital_id="h1", department="Cardiology",  date="2026-07-19", time="11:15", status="scheduled", notes="Follow-up consultation for previous ECG readings."),
            models.Appointment(patient_id="p3", doctor_id="doc-789", hospital_id="h2", department="General OPD", date="2026-07-18", time="09:45", status="completed", notes="Blood sugar report check and consultation."),
        ]
        for appt in appointments:
            db.add(appt)
        db.commit()

        print("Database seeded successfully.")

        # Generate QR codes for all doctors
        _ensure_qr_codes(db)

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()


def _ensure_qr_codes(db):
    """Generate and store QR code data URLs for all doctors that don't have one."""
    try:
        doctors = db.query(models.Doctor).all()
        updated = 0
        for doc in doctors:
            if not doc.qr_code_url or not doc.qr_code_url.startswith('data:image'):
                hospital = db.query(models.Hospital).filter(models.Hospital.id == doc.hospital_id).first()
                if not hospital:
                    continue
                qr_payload = {
                    "type": "hospital_qr",
                    "doctor_id": doc.id,
                    "hospital_id": doc.hospital_id,
                    "department": doc.department,
                    "hospital_name": hospital.name,
                    "doctor_name": doc.name,
                }
                doc.qr_code_url = generate_qr_data_url(qr_payload)
                updated += 1

        if updated > 0:
            db.commit()
            print(f"Generated QR codes for {updated} doctors.")
        else:
            print("All doctors already have QR codes.")
    except Exception as e:
        db.rollback()
        print(f"Error generating QR codes: {e}")


if __name__ == "__main__":
    init_db()
