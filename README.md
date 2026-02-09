# ??? CivicLens AI

AI-Powered Public Services Accountability Dashboard

CivicLens AI is a full-stack, AI-driven dashboard that transforms public complaints and civic feedback into actionable insights. It helps governments, NGOs, and citizens track service failures, monitor response efficiency, and surface urgent issues in real time.

Instead of scattered complaints and unread reports, CivicLens AI provides clarity, transparency, and accountability.

## ?? Problem Statement

Citizens face major issues like:
- No visibility into where complaints go
- Delayed or ignored responses from departments
- No data-driven prioritization of urgent issues

This leads to inefficiency, mistrust, and unresolved civic problems.

## ?? Solution

CivicLens AI:
- Ingests civic complaints (forms, social posts, reports)
- Uses AI to:
- Classify categories
- Summarize issues
- Assign urgency scores
- Displays everything in a live dashboard with:
- City heatmaps
- Department leaderboards
- Urgency alerts
- Trend analytics

## ?? Key Features

- ?? Interactive Dashboard (Next.js + Tailwind)
- ?? AI Complaint Analysis (NLP classification + summaries)
- ??? City Heatmap View
- ?? Department Performance Leaderboard
- ?? High-Urgency Alert System
- ?? API-driven backend (FastAPI)

## ?? Tech Stack

Layer | Tech Used
--- | ---
Frontend | Next.js, Tailwind CSS
Backend | FastAPI (Python)
AI / NLP | OpenAI / HuggingFace
Database | SQLite (MVP)
Maps | Leaflet + OpenStreetMap
Deployment | Vercel + Render / Railway

## ??? Project Structure

```
CivicLens/
??? backend/
?   ??? app/
?   ?   ??? __init__.py
?   ?   ??? main.py
?   ?   ??? db.py
?   ?   ??? geocode_service.py
?   ?   ??? ingest_service.py
?   ?   ??? worker.py
?   ??? requirements.txt
?   ??? .env
??? frontend/
?   ??? src/
?   ?   ??? app/
?   ?       ??? page.tsx
?   ?       ??? dashboard/
?   ?           ??? page.tsx
?   ?           ??? map/page.tsx
?   ?           ??? admin/page.tsx
?   ??? package.json
?   ??? tsconfig.json
??? README.md
```

## ?? Setup Instructions

### 1?? Clone Repo

```
git clone https://github.com/yourusername/civiclens-ai.git
cd civiclens-ai
```

### 2?? Backend Setup (FastAPI)

```
cd backend
python -m venv venv
venv\Scriptsctivate
pip install -r requirements.txt
```

Create `.env` file:

```
HF_TOKEN=your_hugging_face_token_here
HF_MODEL=deepseek-ai/DeepSeek-V3-0324
NOMINATIM_USER_AGENT=civiclens-ai/0.1 (contact: you@example.com)
```

Run server:

```
uvicorn app.main:app --reload
```

API runs at:
- http://localhost:8000

### 3?? Frontend Setup (Next.js)

```
cd ..rontend
npm install
npm run dev
```

Frontend runs at:
- http://localhost:3000

## ?? API Endpoints

Method | Endpoint | Description
--- | --- | ---
GET | `/api/complaints` | Fetch all complaints
POST | `/api/analyze` | Analyze complaint text with AI
POST | `/api/ingest` | Ingest new complaint
GET | `/api/city-stats` | City stats for map view
GET | `/api/admin-analytics` | Admin analytics + alerts

## ?? Demo Flow

1. User submits a civic issue
2. AI classifies & scores urgency
3. Data appears in dashboard
4. Heatmap + alerts update
5. Admin views trends & leaderboards

## ?? Impact

CivicLens AI helps:
- ? Governments improve response efficiency
- ? NGOs detect systemic failures
- ? Citizens gain visibility & trust

This platform turns data into civic action.

## ?? Future Scope

- Real-time social media ingestion
- Mobile app version
- Multilingual AI support
- Integration with official grievance portals
- Predictive analytics for civic risk zones

## ?? Team

- Vijayalakshmi ? Full Stack + AI Developer
- Role: Architecture, Backend, AI, Frontend, UX

## ?? Hackathon Info

Built for: DevDash 2026 ? The Sprint to Solution
Track: AI + Social Good / Developer Tools
