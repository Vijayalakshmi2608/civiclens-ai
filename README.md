# 🏛 CivicLens AI  
### AI-Powered Public Services Accountability & Prediction Platform

CivicLens AI is a full-stack, AI-driven civic intelligence platform that transforms public complaints into **actionable insights, predictions, and accountability metrics** for governments, NGOs, and citizens.

Instead of scattered complaints and unread reports, CivicLens AI provides **clarity, transparency, and proactive governance**.

---

## 🌍 Problem Statement

Cities face major challenges:

• No visibility into where complaints go  
• Delayed or ignored responses  
• No data-driven prioritization  
• No way to predict future civic risks  

This leads to inefficiency, mistrust, and unresolved public issues.

---

## 💡 Solution

CivicLens AI ingests civic complaints and uses **AI + data intelligence** to:

✔ Classify & summarize issues  
✔ Detect root causes  
✔ Predict future risk zones  
✔ Coach departments with AI feedback  
✔ Score trust & transparency  

All results are displayed in a **real-time interactive dashboard**.

---

## 🚀 Core Features

### 1️⃣ AI Root Cause Detection Engine  
Clusters complaints and explains *why* problems keep happening.

### 2️⃣ Predictive Civic Risk Zones  
Forecasts where future issues will occur using ML + weather + census data.

### 3️⃣ AI Department Coaching Reports  
Each department gets AI-generated performance insights and fixes.

### 4️⃣ Multilingual Voice-to-Complaint Intake  
Citizens speak in any language → AI transcribes, translates, analyzes.

### 5️⃣ Civic Trust & Transparency Score  
Public accountability score (0–100) for each department.

---

## 🧠 Tech Stack

| Layer        | Tech Used                                  |
|-------------|---------------------------------------------|
| Frontend     | Next.js, Tailwind CSS, shadcn/ui, Recharts   |
| Backend      | FastAPI (Python)                            |
| AI / NLP     | HuggingFace, Whisper, LLM APIs              |
| ML Models    | Sentence Transformers, XGBoost              |
| Database     | SQLite (MVP)                                |
| Maps         | Leaflet + OpenStreetMap                     |
| Data APIs    | NYC 311, SF 311, Census, NOAA Weather        |
| Deployment   | Vercel + Render / Railway                   |

---

## 📁 Project Structure

CivicLens/
├── backend/
│ ├── app/
│ │ ├── main.py
│ │ ├── db.py
│ │ ├── ingest_service.py
│ │ ├── geocode_service.py
│ │ ├── root_cause_service.py
│ │ ├── risk_zone_model.py
│ │ ├── coaching_service.py
│ │ ├── voice_ingest.py
│ │ ├── trust_score_service.py
│ ├── requirements.txt
│ ├── .env
├── frontend/
│ ├── src/app/
│ │ ├── page.tsx
│ │ ├── dashboard/
│ │ │ ├── page.tsx
│ │ │ ├── map/page.tsx
│ │ │ ├── admin/page.tsx
│ │ │ ├── risk/page.tsx
│ │ │ ├── coaching/page.tsx
│ │ │ ├── trust/page.tsx
│ │ │ ├── voice/page.tsx
│ ├── package.json
│ ├── tsconfig.json
├── README.md


---

## ⚙ Setup Instructions

### 1️⃣ Clone Repo

```bash
git clone https://github.com/yourusername/civiclens-ai.git
cd civiclens-ai
2️⃣ Backend Setup
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
Create .env:

HF_TOKEN=your_huggingface_token
HF_MODEL=deepseek-ai/DeepSeek-V3-0324

NOAA_TOKEN=your_noaa_token
NOAA_CITY_IDS={"New York City":"CITY:US360019","San Francisco":"CITY:US060073"}

CENSUS_API_KEY=your_census_key_optional
CENSUS_YEAR=2022
Run backend:

uvicorn app.main:app --reload
Backend runs at:
➡ http://localhost:8000

3️⃣ Frontend Setup
cd frontend
npm install
npm run dev
Frontend runs at:
➡ http://localhost:3000

🔗 API Endpoints
Method	Endpoint	Description
POST	/api/ingest	Ingest complaint
POST	/api/analyze	Analyze text with AI
POST	/api/root-cause	Root cause clustering
GET	/api/predict-risk-zones	Predict future risk zones
GET	/api/department-coaching	AI coaching reports
POST	/api/voice-ingest	Voice → Text → Analysis
GET	/api/trust-scores	Trust & transparency scores
🎯 Demo Flow
User submits text or voice complaint

AI classifies + scores urgency

Root cause engine clusters issues

ML predicts future risk zones

Departments get AI coaching

Trust scores update in real-time

🌟 Impact
✔ Governments act proactively
✔ NGOs detect systemic failures
✔ Citizens gain visibility & trust

CivicLens AI turns civic data into civic action.

🔮 Future Scope
• Real-time social media ingestion
• Mobile app version
• Multilingual AI expansion
• Policy simulation engine
• National-scale deployment

👩‍💻 Team
Vijayalakshmi
Role: Full-Stack + AI Developer
Focus: Architecture, Backend, ML, Frontend, UX

🏆 Hackathon
Built for: DevDash 2026 – AI + Social Good Track
Theme: Civic Intelligence, Transparency, Accountability
