import os
import time
from typing import Optional, Tuple

import requests

from .db import CityGeo, SessionLocal

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def _get_user_agent() -> str:
    return os.getenv("NOMINATIM_USER_AGENT", "civiclens-ai/0.1")


def geocode_city(city: str) -> Optional[Tuple[float, float]]:
    city = city.strip()
    if not city:
        return None

    with SessionLocal() as session:
        existing = session.query(CityGeo).filter(CityGeo.city == city).first()
        if existing:
            return existing.lat, existing.lng

        params = {"q": city, "format": "json", "limit": 1}
        headers = {"User-Agent": _get_user_agent()}
        resp = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None

        lat = float(data[0]["lat"])
        lng = float(data[0]["lon"])

        record = CityGeo(city=city, lat=lat, lng=lng)
        session.add(record)
        session.commit()

    time.sleep(1.1)  # respect Nominatim usage policy
    return lat, lng
