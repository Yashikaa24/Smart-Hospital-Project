# 🏥 Smart Hospital App

An AI-powered Smart Hospital Management & Patient Portal system built with **React + FastAPI**.

---

## ✨ Features

### 👤 Patient Portal
- **Hospital Explorer** — Interactive map (Leaflet) with crowd levels 🟢🟡🔴, beds, ICU, ambulance stats
- **AI Queue Predictions** — Real-time wait times & confidence scores per doctor
- **Half Token System** — Book from home, auto-converts to Full Token on 200m geofence entry
- **Suggested Departure Time** — Calculates when to leave based on queue ETA & travel time
- **QR Scan** — Scan doctor QR to join queue instantly
- **Live Token Tracker** — Real-time queue updates every 10 seconds

### 🩺 Doctor Portal
- Manage patient queue (Call, Mark Present, Complete)
- QR code generation for clinic
- Live queue dashboard

### 🏢 Hospital Management
- Resource management (Beds, ICU, Ambulances)
- Staff management & analytics

### 🤖 AI Features
- **Symptom Triage** — AI-powered urgency evaluation (Claude API)
- **Virtual Assistant** — Medical Q&A chatbot
- **Queue Prediction** — Dynamic wait time with confidence scoring

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 19 + Vite 8 | UI framework & build tool |
| React Router v7 | Client-side routing |
| Zustand | Global state management |
| Tailwind CSS | Styling |
| Leaflet + React Leaflet | Interactive maps |
| Recharts | Analytics charts |
| Axios | HTTP client |
| Lucide React | Icons |
| Capacitor | Android mobile wrapper |

### Backend
| Technology | Purpose |
|-----------|---------|
| FastAPI | REST API framework |
| SQLAlchemy + SQLite | ORM + Database |
| Pydantic | Schema validation |
| APScheduler | Background job scheduling |
| Anthropic (Claude) | AI features |
| Clerk | Authentication |
| python-jose + passlib | JWT & password hashing |

---

## 🚀 Getting Started

### Backend
```bash
cd hospital-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m app.init_db
uvicorn app.main:app --port 8000 --reload
```

### Frontend
```bash
cd hospital-frontend
npm install
npm run dev
```

Open: `http://localhost:5173`

---

## 📱 Android Build
```bash
cd hospital-frontend
npm run mobile:sync
npm run mobile:android
```

---

## 📁 Project Structure
```
smarthospitalapp/
├── hospital-backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── init_db.py
│   │   ├── routes/
│   │   └── services/
│   └── requirements.txt
└── hospital-frontend/
    ├── src/
    │   ├── pages/
    │   ├── store.js
    │   ├── clerk-mock.jsx
    │   └── App.jsx
    └── package.json
```

---

## 🔗 Key API Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/hospitals/` | List hospitals with live stats |
| GET | `/hospitals/{id}/details` | Departments, doctors, AI predictions |
| POST | `/tokens/create` | Create Full or Half Token |
| GET | `/tokens/{id}` | Token details with ETA |
| GET | `/tokens/queue/{doctor_id}` | Live queue listing |
| PATCH | `/tokens/location/{id}` | Update GPS & trigger geofence |
| POST | `/tokens/call/{id}` | Doctor calls next patient |