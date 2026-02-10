import os
import time
from typing import Optional, Tuple

import requests

from .db import CityGeo, SessionLocal

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
STATIC_COORDS = {
    "Manhattan": (40.7831, -73.9712),
    "Brooklyn": (40.6782, -73.9442),
    "Queens": (40.7282, -73.7949),
    "Bronx": (40.8448, -73.8648),
    "Staten Island": (40.5795, -74.1502),
    "New York City": (40.7128, -74.0060),
    "San Francisco": (37.7749, -122.4194),
}


def _get_user_agent() -> str:
    return os.getenv("NOMINATIM_USER_AGENT", "civiclens-ai/0.1")


def geocode_city(city: str) -> Optional[Tuple[float, float]]:
    city = city.strip()
    if not city:
        return None
    if os.getenv("DISABLE_GEOCODE", "0") == "1":
        return STATIC_COORDS.get(city)

    with SessionLocal() as session:
        existing = session.query(CityGeo).filter(CityGeo.city == city).first()
        if existing:
            return existing.lat, existing.lng
        if city in STATIC_COORDS:
            lat, lng = STATIC_COORDS[city]
            record = CityGeo(city=city, lat=lat, lng=lng)
            session.add(record)
            session.commit()
            return lat, lng

        params = {"q": city, "format": "json", "limit": 1}
        headers = {"User-Agent": _get_user_agent()}
        try:
            resp = requests.get(
                NOMINATIM_URL, params=params, headers=headers, timeout=12
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return None

        if not data:
            return None

        lat = float(data[0]["lat"])
        lng = float(data[0]["lon"])

        record = CityGeo(city=city, lat=lat, lng=lng)
        session.add(record)
        session.commit()

    time.sleep(1.1)  # respect Nominatim usage policy
    return lat, lng
