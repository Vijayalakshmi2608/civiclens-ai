import os
import time
from typing import Dict, Optional

import requests

CENSUS_BASE = "https://api.census.gov/data"

STATE_FIPS = {
    "New York": "36",
    "California": "06",
    "Illinois": "17",
    "Massachusetts": "25",
}

CITY_STATE = {
    "New York City": "New York",
    "San Francisco": "California",
    "Chicago": "Illinois",
    "Boston": "Massachusetts",
}

_CACHE: Dict[str, Dict] = {}

CITY_ALIASES = {
    "MANHATTAN": "New York City",
    "BROOKLYN": "New York City",
    "QUEENS": "New York City",
    "BRONX": "New York City",
    "STATEN ISLAND": "New York City",
    "UNSPECIFIED": "New York City",
    "Manhattan": "New York City",
    "Brooklyn": "New York City",
    "Queens": "New York City",
    "Bronx": "New York City",
    "Staten Island": "New York City",
}

STATIC_CENSUS: Dict[str, Dict[str, float]] = {
    "New York City": {
        "population": 8336817.0,
        "median_income": 76000.0,
        "housing_units": 3600000.0,
        "housing_density": 0.4318,
    },
    "San Francisco": {
        "population": 808437.0,
        "median_income": 136689.0,
        "housing_units": 407000.0,
        "housing_density": 0.5035,
    },
    "Chicago": {
        "population": 2693976.0,
        "median_income": 74279.0,
        "housing_units": 1250000.0,
        "housing_density": 0.4639,
    },
    "Boston": {
        "population": 675647.0,
        "median_income": 96331.0,
        "housing_units": 307000.0,
        "housing_density": 0.4544,
    },
}


def _fetch_state_places(state_fips: str, year: str) -> list[list[str]]:
    url = f"{CENSUS_BASE}/{year}/acs/acs5"
    params = {
        "get": "NAME,B01003_001E,B19013_001E,B25001_001E",
        "for": "place:*",
        "in": f"state:{state_fips}",
        "key": os.getenv("CENSUS_API_KEY", ""),
    }
    resp = requests.get(url, params=params, timeout=12)
    resp.raise_for_status()
    return resp.json()


def get_city_census(city: str) -> Optional[Dict[str, float]]:
    city = (city or "").strip()
    city = CITY_ALIASES.get(city, CITY_ALIASES.get(city.upper(), city))
    year = os.getenv("CENSUS_YEAR", "2022")
    cache_key = f"{city}:{year}"
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    state = CITY_STATE.get(city)
    if not state:
        return None
    state_fips = STATE_FIPS.get(state)
    if not state_fips:
        return None

    try:
        rows = _fetch_state_places(state_fips, year)
    except Exception:
        static = STATIC_CENSUS.get(city)
        if static:
            _CACHE[cache_key] = static
            return static
        return None

    if not rows or len(rows) < 2:
        return None

    header = rows[0]
    name_idx = header.index("NAME")
    pop_idx = header.index("B01003_001E")
    inc_idx = header.index("B19013_001E")
    house_idx = header.index("B25001_001E")

    target = None
    for row in rows[1:]:
        name = row[name_idx]
        if name.lower().startswith(city.lower()):
            target = row
            break

    if not target:
        static = STATIC_CENSUS.get(city)
        if static:
            _CACHE[cache_key] = static
            return static
        return None

    population = float(target[pop_idx]) if target[pop_idx] else 0.0
    median_income = float(target[inc_idx]) if target[inc_idx] else 0.0
    housing_units = float(target[house_idx]) if target[house_idx] else 0.0
    housing_density = housing_units / population if population else 0.0

    data = {
        "population": population,
        "median_income": median_income,
        "housing_units": housing_units,
        "housing_density": housing_density,
    }
    _CACHE[cache_key] = data
    # small TTL-like behavior
    _CACHE[cache_key]["_ts"] = time.time()
    return data

