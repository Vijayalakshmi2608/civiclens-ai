import time
from typing import Iterable

import requests

DEFAULT_POSTS = [
    ("twitter", "Power outage in downtown for 3 hours, traffic lights are out."),
    ("twitter", "Water leaking from a burst pipe near 5th and Pine."),
    ("facebook", "Trash pickup missed again this week in Brookside."),
    ("twitter", "Potholes on Elm Street damaging cars, needs repair soon."),
    ("reddit", "Hospital ER wait times are extreme; please add staff."),
    ("twitter", "Streetlights out on Maple Ave, feels unsafe at night."),
]


def iter_posts() -> Iterable[tuple[str, str]]:
    for source, text in DEFAULT_POSTS:
        yield source, text


def run(interval_seconds: float = 3.0, endpoint: str = "http://localhost:8000/api/ingest") -> None:
    for source, text in iter_posts():
        payload = {"source": source, "text": text}
        try:
            resp = requests.post(endpoint, json=payload, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            print(f"Ingested {source}: {data}")
        except Exception as exc:
            print(f"Failed ingest: {exc}")
        time.sleep(interval_seconds)


if __name__ == "__main__":
    run()
