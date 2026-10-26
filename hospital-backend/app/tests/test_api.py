import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app import models

# Define auth headers using the mock tokens built into auth.py
STAFF_HEADERS = {"Authorization": "Bearer mock-staff-token"}
PATIENT_HEADERS = {"Authorization": "Bearer mock-patient-token"}

@pytest.fixture(scope="module")
def client():
    # Use context manager so the FastAPI lifespan events run (initializing the scheduler)
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the Smart Hospital API"}

def test_get_hospitals_requires_auth(client):
    # Missing auth
    response = client.get("/hospitals/")
    assert response.status_code == 401
    
    # Authorized as patient
    response = client.get("/hospitals/", headers=PATIENT_HEADERS)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) > 0

def test_create_hospital_requires_staff(client):
    # Patient unauthorized to create hospital
    hospital_data = {
        "name": "Test General Hospital",
        "address": "456 Test Lane",
        "phone": "555-9999"
    }
    response = client.post("/hospitals/", json=hospital_data, headers=PATIENT_HEADERS)
    assert response.status_code == 403

    # Staff authorized to create hospital
    response = client.post("/hospitals/", json=hospital_data, headers=STAFF_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test General Hospital"
    assert "id" in data

    # Create doctor for the test hospital
    doctor_data = {
        "name": "Dr. Test Watson",
        "department": "Cardiology",
        "is_available": True,
        "avg_consult_minutes": 15
    }
    doctor_response = client.post(f"/hospitals/{data['id']}/doctors", json=doctor_data, headers=STAFF_HEADERS)
    assert doctor_response.status_code == 200
    doc_data = doctor_response.json()
    assert doc_data["name"] == "Dr. Test Watson"
    assert doc_data["hospital_id"] == data["id"]

def test_resources_endpoints(client):
    # Get test hospital
    hospitals_response = client.get("/hospitals/", headers=PATIENT_HEADERS)
    hospital_id = hospitals_response.json()[0]["id"]

    # Create a resource (requires staff)
    resource_data = {
        "resource_type": "equipment",
        "total": 10,
        "available": 8
    }
    response = client.post(f"/resources/{hospital_id}", json=resource_data, headers=STAFF_HEADERS)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["resource_type"] == "equipment"
    assert res_data["total"] == 10
    assert res_data["available"] == 8
    resource_id = res_data["id"]

    # Get resources for hospital (requires patient auth)
    response = client.get(f"/resources/{hospital_id}", headers=PATIENT_HEADERS)
    assert response.status_code == 200
    resources = response.json()
    assert any(r["id"] == resource_id for r in resources)

    # Update resource available count (requires staff)
    update_data = {"available": 5}
    response = client.patch(f"/resources/{resource_id}", json=update_data, headers=STAFF_HEADERS)
    assert response.status_code == 200
    assert response.json()["available"] == 5

    # Update with invalid count (exceeding total)
    invalid_update = {"available": 15}
    response = client.patch(f"/resources/{resource_id}", json=invalid_update, headers=STAFF_HEADERS)
    assert response.status_code == 400

def test_tokens_flow(client):
    # We will use doctor "doc-123" which is seeded by default in h1
    doctor_id = "doc-123"
    
    # Create token (public endpoint)
    token_data = {
        "doctor_id": doctor_id,
        "patient_name": "Test Patient Alice",
        "phone": "555-1234"
    }
    response = client.post("/tokens/create", json=token_data)
    assert response.status_code == 200
    token = response.json()
    assert token["patient_name"] == "Test Patient Alice"
    assert token["status"] == "waiting"
    assert "token_number" in token
    token_id = token["id"]

    # Get queue for doctor (requires auth)
    response = client.get(f"/tokens/queue/{doctor_id}", headers=PATIENT_HEADERS)
    assert response.status_code == 200
    queue = response.json()
    assert any(item["id"] == token_id for item in queue)

    # Update patient location (requires patient auth)
    loc_data = {"lat": 12.971598, "lng": 77.594562}
    response = client.patch(f"/tokens/location/{token_id}", json=loc_data, headers=PATIENT_HEADERS)
    assert response.status_code == 200
    assert response.json() == {"status": "success"}

    # Call patient (requires staff auth)
    response = client.post(f"/tokens/call/{token_id}", headers=STAFF_HEADERS)
    assert response.status_code == 200
    assert "Patient called" in response.json()["message"]

    # Update token status manually (requires staff auth)
    status_update = {"status": "completed"}
    response = client.patch(f"/tokens/{token_id}", json=status_update, headers=STAFF_HEADERS)
    assert response.status_code == 200
    assert response.json()["status"] == "completed"

    # Get doctor QR code (public endpoint)
    response = client.get(f"/tokens/qr/{doctor_id}")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"

def test_ai_triage(client):
    # Symptoms test matching the low-urgency mock fallback
    triage_data = {"symptoms": "I have a mild fever, sore throat, and a dry cough"}
    response = client.post("/triage/symptoms", json=triage_data, headers=PATIENT_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "urgency" in data
    assert "department" in data
    assert data["urgency"] == "low"
    assert data["department"] == "General Medicine"

    # Symptoms test matching the emergency mock fallback
    triage_data_emergency = {"symptoms": "Sudden severe chest pain and difficulty breathing"}
    response = client.post("/triage/symptoms", json=triage_data_emergency, headers=PATIENT_HEADERS)
    assert response.status_code == 200
    data_emergency = response.json()
    assert data_emergency["urgency"] == "emergency"

def test_chatbot(client):
    # Test chat endpoint with mock hello
    chat_data = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "hospital_name": "City Smart Hospital"
    }
    response = client.post("/chatbot/chat", json=chat_data, headers=PATIENT_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert "City Smart Hospital" in data["reply"]
