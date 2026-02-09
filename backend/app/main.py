import json
import os
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field

from .db import init_db
from .geocode_service import geocode_city
from .ingest_service import ingest_post

app = FastAPI(title="CivicLens AI API")

# Load backend/.env if present
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# CORS: allow local dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CATEGORY_LABELS = ["Water", "Electricity", "Roads", "Healthcare", "Police", "Sanitation"]

class Complaint(BaseModel):
    category: str
    department: str
    city: str
    timestamp: datetime
    description: str
    urgency_score: float = Field(ge=0, le=1)

class AnalyzeRequest(BaseModel):
    text: Optional[str] = None
    description: Optional[str] = None

class AnalyzeResponse(BaseModel):
    category: Literal["Water", "Electricity", "Roads", "Healthcare", "Police", "Sanitation"]
    summary: str
    urgency_score: int = Field(ge=1, le=5)


class IngestRequest(BaseModel):
    source: str = Field(min_length=2, max_length=32)
    text: str = Field(min_length=3, max_length=2000)


class IngestResponse(BaseModel):
    id: int
    category: Literal["Water", "Electricity", "Roads", "Healthcare", "Police", "Sanitation"]
    summary: str
    urgency_score: int = Field(ge=1, le=5)


class CityStat(BaseModel):
    city: str
    count: int
    avg_urgency: float
    categories: List[str]
    lat: float | None = None
    lng: float | None = None


class DepartmentMetric(BaseModel):
    department: str
    avg_resolution_hours: float
    unresolved_cases: int


class AlertsPayload(BaseModel):
    high_urgency_24h: int
    threshold: int
    triggered: bool


class AdminAnalyticsResponse(BaseModel):
    departments: List[DepartmentMetric]
    alerts: AlertsPayload

MOCK_COMPLAINTS: List[Complaint] = [
    Complaint(
        category="Roads",
        department="Public Works",
        city="Riverside",
        timestamp=datetime(2026, 2, 8, 9, 15, 0),
        description="Large pothole on Main St near 3rd Ave causing traffic delays and vehicle damage.",
        urgency_score=0.78,
    ),
    Complaint(
        category="Sanitation",
        department="Waste Management",
        city="Springfield",
        timestamp=datetime(2026, 2, 7, 16, 40, 0),
        description="Missed trash pickup on Oak Lane for the second week in a row.",
        urgency_score=0.42,
    ),
    Complaint(
        category="Police",
        department="Police",
        city="Lakeview",
        timestamp=datetime(2026, 2, 6, 22, 5, 0),
        description="Broken streetlights on Elm Street creating unsafe conditions at night.",
        urgency_score=0.64,
    ),
    Complaint(
        category="Parks",
        department="Parks & Recreation",
        city="Hillcrest",
        timestamp=datetime(2026, 2, 5, 11, 20, 0),
        description="Playground equipment damaged at Maple Park; exposed metal edges.",
        urgency_score=0.71,
    ),
]

@app.get("/api/complaints", response_model=List[Complaint])
def get_complaints():
    return MOCK_COMPLAINTS


@app.get("/api/city-stats", response_model=List[CityStat])
def get_city_stats():
    stats: dict[str, dict] = {}
    for c in MOCK_COMPLAINTS:
        entry = stats.setdefault(
            c.city,
            {"count": 0, "urgency_sum": 0.0, "categories": set()},
        )
        entry["count"] += 1
        entry["urgency_sum"] += c.urgency_score
        entry["categories"].add(c.category)

    results: List[CityStat] = []
    for city, data in stats.items():
        avg = data["urgency_sum"] / data["count"]
        coords = geocode_city(city)
        lat, lng = (coords if coords else (None, None))
        results.append(
            CityStat(
                city=city,
                count=data["count"],
                avg_urgency=avg,
                categories=sorted(list(data["categories"])),
                lat=lat,
                lng=lng,
            )
        )
    return results


@app.get("/api/admin-analytics", response_model=AdminAnalyticsResponse)
def get_admin_analytics():
    # Simulate resolution times and unresolved counts from mock data.
    dept_stats: dict[str, dict] = {}
    now = datetime.utcnow()
    for c in MOCK_COMPLAINTS:
        entry = dept_stats.setdefault(
            c.department,
            {"count": 0, "resolution_sum": 0.0, "unresolved": 0},
        )
        entry["count"] += 1
        # Simulated resolution time inversely related to urgency
        resolution_hours = 2.0 + (1 - c.urgency_score) * 10
        entry["resolution_sum"] += resolution_hours
        # Simulated unresolved if within last 24h and high urgency
        is_recent = (now - c.timestamp).total_seconds() <= 24 * 3600
        if is_recent and c.urgency_score >= 0.7:
            entry["unresolved"] += 1

    departments: List[DepartmentMetric] = []
    for dept, data in dept_stats.items():
        avg = data["resolution_sum"] / max(1, data["count"])
        departments.append(
            DepartmentMetric(
                department=dept,
                avg_resolution_hours=avg,
                unresolved_cases=data["unresolved"],
            )
        )

    # Alert: >10 high-urgency complaints in last 24h
    high_urgency_24h = sum(
        1
        for c in MOCK_COMPLAINTS
        if c.urgency_score >= 0.7
        and (now - c.timestamp).total_seconds() <= 24 * 3600
    )
    threshold = 10
    alerts = AlertsPayload(
        high_urgency_24h=high_urgency_24h,
        threshold=threshold,
        triggered=high_urgency_24h > threshold,
    )

    return AdminAnalyticsResponse(departments=departments, alerts=alerts)


@app.on_event("startup")
def on_startup():
    init_db()


def _heuristic_analyze(text: str) -> AnalyzeResponse:
    text_lower = text.lower()
    category = "Roads"
    keyword_map = {
        "Water": ["water", "leak", "flood", "sewer", "hydrant", "pipe"],
        "Electricity": ["power", "electric", "outage", "transformer", "streetlight", "lights"],
        "Roads": ["pothole", "road", "street", "traffic", "bridge", "sidewalk"],
        "Healthcare": ["clinic", "hospital", "ambulance", "medical", "health"],
        "Police": ["police", "crime", "theft", "assault", "safety", "patrol"],
        "Sanitation": ["trash", "garbage", "waste", "pickup", "dump", "recycling"],
    }
    for label, keys in keyword_map.items():
        if any(k in text_lower for k in keys):
            category = label
            break

    urgency_score = 3
    if any(k in text_lower for k in ["danger", "injury", "urgent", "emergency", "unsafe"]):
        urgency_score = 5
    elif any(k in text_lower for k in ["soon", "accident", "blocking", "flood", "outage"]):
        urgency_score = 4
    elif len(text) < 40:
        urgency_score = 2

    summary = " ".join(text.strip().split())
    if len(summary) > 140:
        summary = summary[:140].rstrip() + "..."

    return AnalyzeResponse(category=category, summary=summary, urgency_score=urgency_score)


def _extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start : end + 1])

    raise ValueError("No JSON object found in model response.")


def _hf_analyze(text: str) -> AnalyzeResponse:
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise RuntimeError("HF_TOKEN not set.")

    client = OpenAI(
        base_url="https://router.huggingface.co/v1",
        api_key=hf_token,
    )

    system_prompt = (
        "You are a civic complaint triage assistant. "
        "Return ONLY a JSON object with keys: category, summary, urgency_score. "
        f"category must be one of: {CATEGORY_LABELS}. "
        "summary must be a single line. urgency_score must be an integer 1-5."
    )

    response = client.chat.completions.create(
        model=os.getenv("HF_MODEL", "deepseek-ai/DeepSeek-V3-0324"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        temperature=0.2,
    )

    content = response.choices[0].message.content or ""
    data = _extract_json(content)

    # Normalize and validate the model output
    category = data.get("category", "Roads")
    if category not in CATEGORY_LABELS:
        category = "Roads"

    summary = str(data.get("summary", "")).strip()
    urgency_score = int(data.get("urgency_score", 3))
    urgency_score = max(1, min(5, urgency_score))

    return AnalyzeResponse(category=category, summary=summary, urgency_score=urgency_score)


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_complaint(payload: AnalyzeRequest):
    raw_text = payload.text or payload.description or ""
    text = raw_text.strip()
    if not text:
        return _heuristic_analyze("No details provided.")

    if os.getenv("HF_TOKEN"):
        try:
            return _hf_analyze(text)
        except Exception:
            # Fall back to deterministic logic if the API call fails.
            return _heuristic_analyze(text)

    return _heuristic_analyze(text)


@app.post("/api/ingest", response_model=IngestResponse)
def ingest_social(payload: IngestRequest):
    result = ingest_post(payload.source, payload.text)
    return IngestResponse(
        id=result.id,
        category=result.category,
        summary=result.summary,
        urgency_score=result.urgency_score,
    )
