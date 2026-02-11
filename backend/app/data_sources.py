import os
import time
from datetime import datetime
from typing import Any, Dict, List

import requests

NYC_URL = "https://data.cityofnewyork.us/resource/erm2-nwe9.json"
SF_URL = "https://data.sfgov.org/resource/vw6y-z8j6.json"
CHI_URL = "https://data.cityofchicago.org/resource/v6vf-nfxy.json"
BOS_URL = "https://data.boston.gov/resource/awu8-dc52.json"

_CACHE: Dict[str, Any] = {"ts": 0.0, "data": []}


def _parse_datetime(value: str | None) -> datetime:
    if not value:
        return datetime.utcnow()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return datetime.utcnow()


def _score_urgency(text: str) -> float:
    text_lower = text.lower()
    score = 0.4
    if any(k in text_lower for k in ["danger", "injury", "urgent", "emergency", "unsafe"]):
        score = 0.85
    elif any(k in text_lower for k in ["outage", "flood", "blocked", "accident"]):
        score = 0.7
    elif len(text) < 40:
        score = 0.3
    return max(0.1, min(0.95, score))


def _safe_get(url: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    try:
        resp = requests.get(url, params=params, timeout=12)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return []


def _normalize_nyc(item: Dict[str, Any]) -> Dict[str, Any]:
    description = (
        item.get("descriptor")
        or item.get("problem_detail")
        or item.get("problem")
        or item.get("complaint_type")
        or "No details provided."
    )
    borough_raw = (item.get("borough") or "").strip()
    borough_map = {
        "MANHATTAN": "Manhattan",
        "BROOKLYN": "Brooklyn",
        "QUEENS": "Queens",
        "BRONX": "Bronx",
        "STATEN ISLAND": "Staten Island",
        "UNSPECIFIED": "New York City",
    }
    city = borough_map.get(borough_raw.upper(), borough_raw.title() if borough_raw else "New York City")
    return {
        "category": item.get("complaint_type") or "General",
        "department": item.get("agency") or "NYC 311",
        "city": city,
        "timestamp": _parse_datetime(item.get("created_date")),
        "description": description,
        "urgency_score": _score_urgency(description),
    }


def _normalize_sf(item: Dict[str, Any]) -> Dict[str, Any]:
    description = (
        item.get("description")
        or item.get("service_subtype")
        or item.get("service_name")
        or item.get("title")
        or "No details provided."
    )
    return {
        "category": item.get("service_name") or item.get("category") or "General",
        "department": item.get("agency_responsible") or item.get("department") or "SF 311",
        "city": "San Francisco",
        "timestamp": _parse_datetime(item.get("requested_datetime") or item.get("created_at")),
        "description": description,
        "urgency_score": _score_urgency(description),
    }


def _normalize_chicago(item: Dict[str, Any]) -> Dict[str, Any]:
    description = (
        item.get("service_request_type")
        or item.get("street_address")
        or item.get("ward")
        or "No details provided."
    )
    return {
        "category": item.get("service_request_type") or "General",
        "department": item.get("department") or item.get("agency") or "Chicago 311",
        "city": "Chicago",
        "timestamp": _parse_datetime(item.get("creation_date")),
        "description": description,
        "urgency_score": _score_urgency(description),
    }


def _normalize_boston(item: Dict[str, Any]) -> Dict[str, Any]:
    description = (
        item.get("reason")
        or item.get("type")
        or item.get("subject")
        or "No details provided."
    )
    return {
        "category": item.get("reason") or item.get("type") or "General",
        "department": item.get("department") or item.get("case_department") or "Boston 311",
        "city": "Boston",
        "timestamp": _parse_datetime(item.get("open_dt") or item.get("created_dt")),
        "description": description,
        "urgency_score": _score_urgency(description),
    }


def fetch_combined_complaints(limit_per_city: int = 50) -> List[Dict[str, Any]]:
    nyc_params = {"$limit": limit_per_city, "$order": "created_date DESC"}
    sf_params = {"$limit": limit_per_city, "$order": "created_at DESC"}
    chi_params = {"$limit": limit_per_city, "$order": "creation_date DESC"}
    bos_params = {"$limit": limit_per_city, "$order": "open_dt DESC"}

    nyc_raw = _safe_get(NYC_URL, nyc_params)
    sf_raw = _safe_get(SF_URL, sf_params)
    chi_raw = _safe_get(CHI_URL, chi_params)
    bos_raw = _safe_get(BOS_URL, bos_params)

    nyc = [_normalize_nyc(item) for item in nyc_raw]
    sf = [_normalize_sf(item) for item in sf_raw]
    chi = [_normalize_chicago(item) for item in chi_raw]
    bos = [_normalize_boston(item) for item in bos_raw]
    return nyc + sf + chi + bos


def get_complaints_cached() -> List[Dict[str, Any]]:
    ttl = int(os.getenv("COMPLAINTS_CACHE_SECONDS", "300"))
    now = time.time()
    if _CACHE["data"] and now - _CACHE["ts"] < ttl:
        return _CACHE["data"]

    data = fetch_combined_complaints()
    if data:
        _CACHE["data"] = data
        _CACHE["ts"] = now
    return _CACHE["data"]
