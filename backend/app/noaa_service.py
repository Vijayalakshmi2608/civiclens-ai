import json
import os
from datetime import date, timedelta
from typing import Dict, Optional

import requests

NOAA_BASE = "https://www.ncdc.noaa.gov/cdo-web/api/v2"

DEFAULT_CITY_IDS = {
    "New York City": "CITY:US360019",
    "San Francisco": "CITY:US060073",
    "Chicago": "CITY:US170031",
    "Boston": "CITY:US250030",
}


def _get_city_ids() -> Dict[str, str]:
    raw = os.getenv("NOAA_CITY_IDS")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            return DEFAULT_CITY_IDS
    return DEFAULT_CITY_IDS


def get_recent_weather(city: str) -> Optional[Dict[str, float]]:
    token = os.getenv("NOAA_TOKEN")
    if not token:
        return None

    city_ids = _get_city_ids()
    location_id = city_ids.get(city)
    if not location_id:
        return None

    end = date.today()
    start = end - timedelta(days=7)
    params = {
        "datasetid": "GHCND",
        "locationid": location_id,
        "startdate": start.isoformat(),
        "enddate": end.isoformat(),
        "datatypeid": ["PRCP", "TMAX"],
        "limit": 1000,
        "units": "metric",
    }
    headers = {"token": token}
    try:
        resp = requests.get(f"{NOAA_BASE}/data", params=params, headers=headers, timeout=12)
        resp.raise_for_status()
        payload = resp.json()
    except Exception:
        return None

    results = payload.get("results", [])
    if not results:
        return None

    total_prcp = 0.0
    tmax_values = []
    for item in results:
        if item.get("datatype") == "PRCP":
            total_prcp += float(item.get("value", 0))
        elif item.get("datatype") == "TMAX":
            tmax_values.append(float(item.get("value", 0)))

    return {
        "precip_mm_7d": total_prcp,
        "tmax_c_7d": max(tmax_values) if tmax_values else 0.0,
    }
