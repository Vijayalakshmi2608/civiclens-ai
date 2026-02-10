from __future__ import annotations

from datetime import datetime
from typing import Dict, List

import numpy as np
import pandas as pd

from .data_sources import get_complaints_cached
from .db import IngestedComplaint, SessionLocal


def _load_complaints() -> pd.DataFrame:
    with SessionLocal() as session:
        records = session.query(IngestedComplaint).all()

    rows = []
    for r in records:
        rows.append(
            {
                "department": r.category if r.category else "Unknown",
                "urgency_score": r.urgency_score,
                "created_at": r.created_at,
                "text": r.text,
            }
        )

    if rows:
        return pd.DataFrame(rows)

    live = get_complaints_cached()
    if not live:
        return pd.DataFrame()

    for c in live:
        rows.append(
            {
                "department": c.get("department", "Unknown"),
                "urgency_score": c.get("urgency_score", 0.5),
                "created_at": c.get("timestamp", datetime.utcnow()),
                "text": c.get("description", ""),
            }
        )
    return pd.DataFrame(rows)


def _sentiment_score(text: str) -> float:
    text = (text or "").lower()
    if any(k in text for k in ["angry", "frustrated", "unsafe", "danger", "urgent"]):
        return 0.2
    if any(k in text for k in ["thanks", "resolved", "appreciate"]):
        return 0.8
    return 0.5


def compute_trust_scores() -> List[Dict]:
    df = _load_complaints()
    if df.empty:
        return []

    df["sentiment"] = df["text"].apply(_sentiment_score)
    df["response_time"] = 2.0 + (1 - df["urgency_score"].astype(float)) * 10

    grouped = df.groupby("department").agg(
        avg_response_time=("response_time", "mean"),
        sentiment_score=("sentiment", "mean"),
        total=("text", "count"),
    )

    # resolution rate proxy: fewer high-urgency items implies higher resolution rate
    high_urgency = df[df["urgency_score"] >= 0.7].groupby("department").size()
    grouped["high_urgency"] = high_urgency
    grouped["high_urgency"] = grouped["high_urgency"].fillna(0)
    grouped["resolution_rate"] = 1 - (grouped["high_urgency"] / grouped["total"]).clip(0, 1)

    # repeat complaint ratio proxy via duplicate text counts
    dup_counts = (
        df.groupby(["department", "text"]).size().reset_index(name="count")
    )
    repeat_ratio = (
        dup_counts[dup_counts["count"] > 1]
        .groupby("department")["count"]
        .sum()
    )
    grouped["repeat_complaint_ratio"] = (
        repeat_ratio / grouped["total"]
    ).fillna(0).clip(0, 1)

    # Normalize metrics
    def _normalize(series: pd.Series, invert: bool = False) -> pd.Series:
        if series.max() == series.min():
            return pd.Series([0.5] * len(series), index=series.index)
        norm = (series - series.min()) / (series.max() - series.min())
        return 1 - norm if invert else norm

    grouped["n_response_time"] = _normalize(grouped["avg_response_time"], invert=True)
    grouped["n_resolution_rate"] = _normalize(grouped["resolution_rate"], invert=False)
    grouped["n_sentiment"] = _normalize(grouped["sentiment_score"], invert=False)
    grouped["n_repeat_ratio"] = _normalize(grouped["repeat_complaint_ratio"], invert=True)

    grouped["trust_score"] = (
        0.35 * grouped["n_resolution_rate"]
        + 0.25 * grouped["n_response_time"]
        + 0.25 * grouped["n_sentiment"]
        + 0.15 * grouped["n_repeat_ratio"]
    ) * 100

    results = []
    for dept, row in grouped.iterrows():
        results.append(
            {
                "department": dept,
                "trust_score": float(row["trust_score"]),
                "metric_breakdown": {
                    "avg_response_time": float(row["avg_response_time"]),
                    "resolution_rate": float(row["resolution_rate"]),
                    "sentiment_score": float(row["sentiment_score"]),
                    "repeat_complaint_ratio": float(row["repeat_complaint_ratio"]),
                },
            }
        )

    results.sort(key=lambda r: r["trust_score"], reverse=True)
    return results
