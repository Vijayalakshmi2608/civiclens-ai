from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

from .census_service import get_city_census
from .db import IngestedComplaint, SessionLocal
from .noaa_service import get_recent_weather


def _load_complaints(days: int = 90) -> pd.DataFrame:
    cutoff = datetime.utcnow() - timedelta(days=days)
    with SessionLocal() as session:
        records = (
            session.query(IngestedComplaint)
            .filter(IngestedComplaint.created_at >= cutoff)
            .all()
        )

    if not records:
        return pd.DataFrame()

    rows = [
        {
            "city": r.city,
            "created_at": r.created_at,
            "category": r.category,
        }
        for r in records
    ]
    return pd.DataFrame(rows)


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    now = datetime.utcnow()
    df["date"] = pd.to_datetime(df["created_at"]).dt.date
    df["week"] = pd.to_datetime(df["created_at"]).dt.to_period("W").dt.start_time

    complaints_last_7 = (
        df[df["created_at"] >= (now - timedelta(days=7))]
        .groupby("city")
        .size()
        .rename("complaints_last_7_days")
    )

    weekly_counts = (
        df.groupby(["city", "week"])
        .size()
        .reset_index(name="complaint_volume")
    )

    weekly_counts["time_of_year"] = weekly_counts["week"].dt.month

    features = weekly_counts.merge(
        complaints_last_7, on="city", how="left"
    ).fillna({"complaints_last_7_days": 0})

    weather_scores = {}
    density_scores = {}
    for city in features["city"].unique():
        weather = get_recent_weather(city) or {}
        precip = weather.get("precip_mm_7d", 0.0)
        tmax = weather.get("tmax_c_7d", 0.0)
        weather_scores[city] = min(100.0, precip * 2 + max(0, tmax - 25) * 3)

        census = get_city_census(city) or {}
        population = census.get("population") or 0.0
        housing = census.get("housing_units") or 0.0
        density = (housing / population) if population else 0.0
        density_scores[city] = density

    features["weather_severity_score"] = features["city"].map(weather_scores).fillna(0)
    features["population_density"] = features["city"].map(density_scores).fillna(0)
    return features


def predict_risk_zones() -> List[Dict[str, Any]]:
    df = _load_complaints(90)
    if df.empty:
        return []

    features = _build_features(df)
    if features.empty:
        return []

    X_num = features[
        ["complaints_last_7_days", "weather_severity_score", "population_density", "time_of_year"]
    ].to_numpy()

    encoder = OneHotEncoder(sparse_output=False, handle_unknown="ignore")
    X_city = encoder.fit_transform(features[["city"]])
    X = np.hstack([X_num, X_city])
    y = features["complaint_volume"].to_numpy()

    model = XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
    )
    model.fit(X, y)

    preds = model.predict(X)
    features["risk_score"] = preds

    # Predicted issue types = top categories per city in last 30 days
    recent = df[df["created_at"] >= (datetime.utcnow() - timedelta(days=30))]
    top_types = (
        recent.groupby(["city", "category"])
        .size()
        .reset_index(name="count")
        .sort_values(["city", "count"], ascending=[True, False])
    )

    top_map: Dict[str, List[str]] = {}
    for city in features["city"].unique():
        subset = top_types[top_types["city"] == city].head(3)
        top_map[city] = subset["category"].tolist()

    output = (
        features.sort_values("risk_score", ascending=False)
        .groupby("city", as_index=False)
        .first()
        .sort_values("risk_score", ascending=False)
        .head(10)
    )

    results = []
    for _, row in output.iterrows():
        results.append(
            {
                "zone_id": row["city"],
                "risk_score": float(row["risk_score"]),
                "predicted_issue_types": top_map.get(row["city"], []),
            }
        )

    return results
