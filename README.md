# CivicLens AI

**AI-Powered Public Services Accountability & Predictive Intelligence Platform**

CivicLens AI is a full-stack, AI-driven dashboard that transforms public complaints and civic feedback into actionable and predictive insights. It helps governments, NGOs, and citizens track service failures, monitor response efficiency, and prevent issues before they escalate. Instead of scattered complaints and unread reports, CivicLens AI provides clarity, transparency, and accountability.

---

## 🚨 Problem

Cities receive millions of service requests every year, but:

- Complaints disappear into black boxes
- Responses are slow or ignored
- Urgent issues aren't prioritized
- Citizens lose trust

This leads to inefficiency, frustration, and unresolved civic problems.

---

## 💡 Solution

CivicLens AI turns raw civic data into predictive intelligence. It:

- Ingests real 311 data (NYC & SF)
- Uses AI to classify, summarize, and score urgency
- Clusters complaints to detect root causes
- Predicts future risk zones
- Generates AI coaching reports for departments
- Calculates Trust & Transparency Scores
- Supports voice-based complaint intake

---

## ✨ Key Features

- 🧠 **AI Complaint Analysis** (NLP + LLMs)
- 🗺️ **City Heatmaps & Risk Zone Forecasting**
- 🧩 **Root Cause Clustering Engine**
- 📊 **Department Performance Coaching Reports**
- 🔊 **Voice → Text → AI Analysis**
- 🔐 **Trust & Transparency Scoring System**
- ⚡ **Real-time Dashboards** (Next.js + Tailwind)

---

## 🏗️ Tech Stack

| Layer | Tech Used |
|-------|-----------|
| **Frontend** | Next.js, Tailwind CSS |
| **Backend** | FastAPI (Python) |
| **AI / NLP** | HuggingFace / DeepSeek LLM |
| **ML** | Clustering + Risk Prediction Models |
| **Database** | SQLite (MVP) |
| **Maps** | Leaflet + OpenStreetMap |
| **APIs** | NYC 311, SF 311, NOAA, U.S. Census |
| **Deployment** | Vercel + Render / Railway |

---

## 📁 Project Structure

```
CivicLens/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── db.py
│   │   ├── ingest_service.py
│   │   ├── geocode_service.py
│   │   ├── root_cause_service.py
│   │   ├── risk_zone_model.py
│   │   ├── coaching_service.py
│   │   ├── voice_ingest.py
│   │   ├── trust_score_service.py
│   ├── requirements.txt
│   ├── .env
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── map/page.tsx
│   │   │   ├── admin/page.tsx
│   │   │   ├── risk/page.tsx
│   │   │   ├── coaching/page.tsx
│   │   │   ├── trust/page.tsx
│   │   │   ├── voice/page.tsx
│   ├── package.json
│   ├── tsconfig.json
├── README.md
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repo

```bash
git clone https://github.com/yourusername/civiclens-ai.git
cd civiclens-ai
```

### 2️⃣ Backend Setup (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

**Create `.env` file:**

```env
HF_TOKEN=your_huggingface_token
HF_MODEL=deepseek-ai/DeepSeek-V3-0324
NOAA_TOKEN=your_noaa_token
NOAA_CITY_IDS={"New York City":"CITY:US360019","San Francisco":"CITY:US060073"}
CENSUS_API_KEY=your_census_key_optional
CENSUS_YEAR=2022
```

**Run backend:**

```bash
uvicorn app.main:app --reload
```

➡️ Backend runs at: `http://localhost:8000`

### 3️⃣ Frontend Setup (Next.js)

```bash
cd frontend
npm install
npm run dev
```

➡️ Frontend runs at: `http://localhost:3000`

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest` | Ingest complaint |
| POST | `/api/analyze` | AI analyze text |
| POST | `/api/root-cause` | Root cause clustering |
| GET | `/api/predict-risk-zones` | Predict future risk zones |
| GET | `/api/department-coaching` | AI coaching reports |
| POST | `/api/voice-ingest` | Voice → Text → Analysis |
| GET | `/api/trust-scores` | Trust & transparency scores |

---

## 🎯 Demo Flow

1. User submits text or voice complaint
2. AI classifies + scores urgency
3. Root-cause engine clusters issues
4. ML predicts future risk zones
5. Departments receive AI coaching
6. Trust scores update in real-time

---

## 🌍 Impact

✔ Governments act proactively  
✔ NGOs detect systemic failures  
✔ Citizens gain visibility & trust  

**CivicLens AI turns civic data into civic action.**

---

## 🔮 Future Scope

- Real-time social media ingestion
- Multilingual AI support
- Mobile citizen app
- Policy simulation engine
- National-scale smart city deployment

---

## 👩‍💻 Team

**Vijayalakshmi**  
Role: Full-Stack + AI Developer  
Focus: Architecture, Backend, ML, Frontend, UX

---

## 🏆 Hackathon

**Built for:** DevDash 2026 – AI + Social Good Track  
**Theme:** Civic Intelligence, Transparency, Accountability

---

## 📄 License

Apache Licnse 2.0 - See LICENSE file for details

---
## Demo Screenshots
![image (4)](https://github.com/user-attachments/assets/2c0fed0b-805b-44a6-b61c-e09d132ed4bb)
![image (5)](https://github.com/user-attachments/assets/050c9d0d-fcbe-4844-ada9-4a7cfa7dae41)
![image (6)](https://github.com/user-attachments/assets/11c58992-a54b-441d-b083-5680433cd0d8)
![image (8)](https://github.com/user-attachments/assets/7dfb546b-b34c-4c96-9a75-d4f24a7f01da)
![image (9)](https://github.com/user-attachments/assets/35c391a8-12d2-4c56-a1c8-672d3df57685)



---



## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---
