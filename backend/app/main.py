import os
from datetime import datetime
from typing import List, Literal

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field

from .analysis import (
    AnalyzeRequest,
    AnalyzeResponse,
    CityReportRequest,
    CityReportResponse,
    DepartmentCoachingReport,
    DepartmentCoachingRequest,
    analyze_complaint,
    generate_city_report,
    generate_department_coaching,
)
from .census_service import get_city_census
from .data_sources import get_complaints_cached
from .db import SessionLocal, VoiceIngest, init_db
from .geocode_service import geocode_city
from .ingest_service import ingest_post
from .noaa_service import get_recent_weather
from .root_cause_service import build_root_cause_clusters
from .risk_service import predict_risk_zones
from .trust_service import compute_trust_scores
from .voice_service import analyze_voice_text, transcribe_audio, translate_to_english

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

class Complaint(BaseModel):
    category: str
    department: str
    city: str
    timestamp: datetime
    description: str
    urgency_score: float = Field(ge=0, le=1)

class IngestRequest(BaseModel):
    source: str = Field(min_length=2, max_length=32)
    text: str = Field(min_length=3, max_length=2000)
    city: str | None = None


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


class CityInsight(BaseModel):
    city: str
    complaints: int
    avg_urgency: float
    population: float | None = None
    median_income: float | None = None
    housing_units: float | None = None
    housing_density: float | None = None
    precip_mm_7d: float | None = None
    tmax_c_7d: float | None = None


class CityCompareMetric(BaseModel):
    city: str
    complaints_per_10k: float | None = None
    avg_urgency: float
    avg_resolution_hours: float


class DepartmentCoachingResponse(BaseModel):
    department_name: str
    coaching_report: DepartmentCoachingReport


class RootCauseRequest(BaseModel):
    city: str
    days: int = 7


class RootCauseCluster(BaseModel):
    cluster_id: int
    root_cause_summary: str
    top_keywords: List[str]
    affected_departments: List[str]
    example_complaints: List[str]
    locations: List[str]


class RiskZoneResponse(BaseModel):
    zone_id: str
    risk_score: float
    predicted_issue_types: List[str]


class VoiceIngestResponse(BaseModel):
    original_text: str
    translated_text: str
    category: str
    urgency_score: int


class TrustScoreResponse(BaseModel):
    department: str
    trust_score: float
    metric_breakdown: dict


class EquityBucketMetric(BaseModel):
    income_bucket: str
    complaints_per_10k: float | None = None
    unresolved_pct: float


class EquityResponse(BaseModel):
    service_equity_score: float
    inequality_index: float
    buckets: List[EquityBucketMetric]
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
    data = get_complaints_cached()
    if data:
        return data
    return MOCK_COMPLAINTS


@app.get("/api/city-stats", response_model=List[CityStat])
def get_city_stats():
    complaints = get_complaints_cached() or MOCK_COMPLAINTS
    stats: dict[str, dict] = {}
    for c in complaints:
        city = c.get("city") if isinstance(c, dict) else c.city
        category = c.get("category") if isinstance(c, dict) else c.category
        urgency = c.get("urgency_score") if isinstance(c, dict) else c.urgency_score
        entry = stats.setdefault(
            city,
            {"count": 0, "urgency_sum": 0.0, "categories": set()},
        )
        entry["count"] += 1
        entry["urgency_sum"] += float(urgency)
        entry["categories"].add(category)

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
    complaints = get_complaints_cached() or MOCK_COMPLAINTS
    for c in complaints:
        department = c.get("department") if isinstance(c, dict) else c.department
        urgency = c.get("urgency_score") if isinstance(c, dict) else c.urgency_score
        timestamp = c.get("timestamp") if isinstance(c, dict) else c.timestamp
        entry = dept_stats.setdefault(
            department,
            {"count": 0, "resolution_sum": 0.0, "unresolved": 0},
        )
        entry["count"] += 1
        # Simulated resolution time inversely related to urgency
        resolution_hours = 2.0 + (1 - float(urgency)) * 10
        entry["resolution_sum"] += resolution_hours
        # Simulated unresolved if within last 24h and high urgency
        is_recent = (now - timestamp).total_seconds() <= 24 * 3600
        if is_recent and float(urgency) >= 0.7:
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
    high_urgency_24h = 0
    for c in complaints:
        urgency = c.get("urgency_score") if isinstance(c, dict) else c.urgency_score
        timestamp = c.get("timestamp") if isinstance(c, dict) else c.timestamp
        if float(urgency) >= 0.7 and (now - timestamp).total_seconds() <= 24 * 3600:
            high_urgency_24h += 1
    threshold = 10
    alerts = AlertsPayload(
        high_urgency_24h=high_urgency_24h,
        threshold=threshold,
        triggered=high_urgency_24h > threshold,
    )

    return AdminAnalyticsResponse(departments=departments, alerts=alerts)


@app.get("/api/city-insights", response_model=List[CityInsight])
def get_city_insights():
    complaints = get_complaints_cached() or MOCK_COMPLAINTS
    stats: dict[str, dict] = {}
    for c in complaints:
        city = c.get("city") if isinstance(c, dict) else c.city
        urgency = c.get("urgency_score") if isinstance(c, dict) else c.urgency_score
        entry = stats.setdefault(city, {"count": 0, "urgency_sum": 0.0})
        entry["count"] += 1
        entry["urgency_sum"] += float(urgency)

    results: List[CityInsight] = []
    for city, data in stats.items():
        avg = data["urgency_sum"] / data["count"]
        census = get_city_census(city) or {}
        weather = get_recent_weather(city) or {}
        results.append(
            CityInsight(
                city=city,
                complaints=data["count"],
                avg_urgency=avg,
                population=census.get("population"),
                median_income=census.get("median_income"),
                housing_units=census.get("housing_units"),
                housing_density=census.get("housing_density"),
                precip_mm_7d=weather.get("precip_mm_7d"),
                tmax_c_7d=weather.get("tmax_c_7d"),
            )
        )
    return results


@app.get("/api/city-compare", response_model=List[CityCompareMetric])
def get_city_compare():
    complaints = get_complaints_cached() or MOCK_COMPLAINTS
    stats: dict[str, dict] = {}
    for c in complaints:
        city = c.get("city") if isinstance(c, dict) else c.city
        urgency = c.get("urgency_score") if isinstance(c, dict) else c.urgency_score
        entry = stats.setdefault(
            city,
            {"count": 0, "urgency_sum": 0.0, "resolution_sum": 0.0},
        )
        entry["count"] += 1
        entry["urgency_sum"] += float(urgency)
        entry["resolution_sum"] += 2.0 + (1 - float(urgency)) * 10

    results: List[CityCompareMetric] = []
    for city, data in stats.items():
        avg_urgency = data["urgency_sum"] / data["count"]
        avg_resolution = data["resolution_sum"] / data["count"]
        census = get_city_census(city) or {}
        population = census.get("population") or 0.0
        complaints_per_10k = (
            (data["count"] / population) * 10000 if population else None
        )
        results.append(
            CityCompareMetric(
                city=city,
                complaints_per_10k=complaints_per_10k,
                avg_urgency=avg_urgency,
                avg_resolution_hours=avg_resolution,
            )
        )
    return results


@app.get("/api/department-coaching", response_model=List[DepartmentCoachingResponse])
def get_department_coaching():
    complaints = get_complaints_cached() or MOCK_COMPLAINTS
    dept_stats: dict[str, dict] = {}
    now = datetime.utcnow()

    for c in complaints:
        department = c.get("department") if isinstance(c, dict) else c.department
        urgency = c.get("urgency_score") if isinstance(c, dict) else c.urgency_score
        timestamp = c.get("timestamp") if isinstance(c, dict) else c.timestamp
        description = c.get("description") if isinstance(c, dict) else c.description

        entry = dept_stats.setdefault(
            department,
            {
                "count": 0,
                "resolution_sum": 0.0,
                "reopen_count": 0,
                "sentiment_sum": 0.0,
            },
        )
        entry["count"] += 1
        entry["resolution_sum"] += 2.0 + (1 - float(urgency)) * 10

        # Reopen rate proxy: recent high-urgency issues tend to reopen
        if float(urgency) >= 0.7 and (now - timestamp).total_seconds() <= 24 * 3600:
            entry["reopen_count"] += 1

        # Simple sentiment heuristic from description
        text = (description or "").lower()
        sentiment = 0.5
        if any(k in text for k in ["danger", "injury", "urgent", "unsafe", "angry"]):
            sentiment = 0.2
        elif any(k in text for k in ["thanks", "resolved", "appreciate"]):
            sentiment = 0.8
        entry["sentiment_sum"] += sentiment

    results: List[DepartmentCoachingResponse] = []
    for dept, data in dept_stats.items():
        count = data["count"]
        stats = DepartmentCoachingRequest(
            department_name=dept,
            total_complaints=count,
            avg_resolution_hours=data["resolution_sum"] / max(1, count),
            reopen_rate=data["reopen_count"] / max(1, count),
            sentiment_score=data["sentiment_sum"] / max(1, count),
        )
        report = generate_department_coaching(stats)
        results.append(
            DepartmentCoachingResponse(
                department_name=dept,
                coaching_report=report,
            )
        )

    return results


@app.post("/api/root-cause", response_model=List[RootCauseCluster])
def root_cause(payload: RootCauseRequest):
    live = get_complaints_cached()
    city = payload.city
    fallback = None
    if live:
        fallback = [
            c
            for c in live
            if (c.get("city") if isinstance(c, dict) else c.city) == city
            or city.lower() == "all"
        ]
    return build_root_cause_clusters(payload.city, payload.days, fallback_records=fallback)


@app.get("/api/predict-risk-zones", response_model=List[RiskZoneResponse])
def predict_risk():
    return predict_risk_zones()


@app.post("/api/voice-ingest", response_model=VoiceIngestResponse)
def voice_ingest(audio_file: UploadFile = File(...)):
    language, original_text = transcribe_audio(audio_file)
    translated_text = translate_to_english(original_text, language)
    analysis = analyze_voice_text(translated_text or original_text)

    with SessionLocal() as session:
        record = VoiceIngest(
            language=language,
            original_text=original_text,
            translated_text=translated_text,
            category=analysis.category,
            urgency_score=analysis.urgency_score,
        )
        session.add(record)
        session.commit()

    return VoiceIngestResponse(
        original_text=original_text,
        translated_text=translated_text,
        category=analysis.category,
        urgency_score=analysis.urgency_score,
    )


@app.get("/api/trust-scores", response_model=List[TrustScoreResponse])
def trust_scores():
    return compute_trust_scores()


@app.get("/api/impact/equity", response_model=EquityResponse)
def get_equity_metrics():
    complaints = get_complaints_cached() or MOCK_COMPLAINTS
    city_stats: dict[str, dict] = {}
    now = datetime.utcnow()

    for c in complaints:
        city = c.get("city") if isinstance(c, dict) else c.city
        urgency = c.get("urgency_score") if isinstance(c, dict) else c.urgency_score
        timestamp = c.get("timestamp") if isinstance(c, dict) else c.timestamp
        entry = city_stats.setdefault(
            city,
            {"count": 0, "high_urgency": 0, "recent_high": 0},
        )
        entry["count"] += 1
        if float(urgency) >= 0.7:
            entry["high_urgency"] += 1
            if (now - timestamp).total_seconds() <= 24 * 3600:
                entry["recent_high"] += 1

    buckets = {
        "Low income (<$50k)": {"count": 0, "population": 0.0, "unresolved": 0},
        "Mid income ($50k-$100k)": {"count": 0, "population": 0.0, "unresolved": 0},
        "High income (>$100k)": {"count": 0, "population": 0.0, "unresolved": 0},
    }

    for city, data in city_stats.items():
        census = get_city_census(city) or {}
        income = census.get("median_income")
        population = census.get("population") or 0.0
        if income is None:
            continue
        if income < 50000:
            bucket = buckets["Low income (<$50k)"]
        elif income <= 100000:
            bucket = buckets["Mid income ($50k-$100k)"]
        else:
            bucket = buckets["High income (>$100k)"]

        bucket["count"] += data["count"]
        bucket["population"] += population
        bucket["unresolved"] += data["recent_high"]

    bucket_metrics: List[EquityBucketMetric] = []
    complaints_rates = []
    for name, data in buckets.items():
        rate = (data["count"] / data["population"]) * 10000 if data["population"] else None
        if rate is not None:
            complaints_rates.append(rate)
        unresolved_pct = (data["unresolved"] / data["count"]) * 100 if data["count"] else 0.0
        bucket_metrics.append(
            EquityBucketMetric(
                income_bucket=name,
                complaints_per_10k=rate,
                unresolved_pct=unresolved_pct,
            )
        )

    if complaints_rates:
        inequality_index = max(complaints_rates) - min(complaints_rates)
    else:
        inequality_index = 0.0

    inequality_index = min(100.0, max(0.0, inequality_index))
    service_equity_score = max(0.0, 100.0 - inequality_index)

    return EquityResponse(
        service_equity_score=service_equity_score,
        inequality_index=inequality_index,
        buckets=bucket_metrics,
    )


@app.on_event("startup")
def on_startup():
    init_db()

@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_endpoint(payload: AnalyzeRequest):
    return analyze_complaint(payload)


@app.post("/api/ai/city-report", response_model=CityReportResponse)
def city_report(payload: CityReportRequest):
    complaints = get_complaints_cached() or MOCK_COMPLAINTS
    city = payload.city
    filtered = [
        c
        for c in complaints
        if (c.get("city") if isinstance(c, dict) else c.city) == city
    ]
    if not filtered:
        return generate_city_report(city, context={"note": "No local complaints found."})

    category_counts: dict[str, int] = {}
    high_urgency = 0
    for c in filtered:
        category = c.get("category") if isinstance(c, dict) else c.category
        urgency = c.get("urgency_score") if isinstance(c, dict) else c.urgency_score
        category_counts[category] = category_counts.get(category, 0) + 1
        if float(urgency) >= 0.7:
            high_urgency += 1

    top_categories = sorted(
        category_counts.items(), key=lambda kv: kv[1], reverse=True
    )[:5]

    context = {
        "city": city,
        "total_complaints": len(filtered),
        "high_urgency_count": high_urgency,
        "top_categories": top_categories,
    }

    return generate_city_report(city, context=context)


@app.post("/api/ingest", response_model=IngestResponse)
def ingest_social(payload: IngestRequest):
    result = ingest_post(payload.source, payload.text, payload.city)
    return IngestResponse(
        id=result.id,
        category=result.category,
        summary=result.summary,
        urgency_score=result.urgency_score,
    )
