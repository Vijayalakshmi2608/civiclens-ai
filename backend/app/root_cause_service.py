import os
import re
from datetime import datetime, timedelta
from typing import Any, List

from .analysis import _extract_json
from .db import IngestedComplaint, SessionLocal
from openai import OpenAI

_EMBEDDER: Any = None


def _get_embedder():
    global _EMBEDDER
    if _EMBEDDER is None:
        _EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2")
    return _EMBEDDER


def _extract_locations(text: str) -> List[str]:
    patterns = re.findall(
        r"([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Park|Bridge)",
        text,
    )
    return list({f"{name} {suffix}" for name, suffix in patterns})


def _infer_departments(texts: List[str]) -> List[str]:
    joined = " ".join(texts).lower()
    mapping = {
        "Police": ["police", "crime", "patrol", "theft"],
        "Sanitation": ["trash", "garbage", "waste", "recycling"],
        "Public Works": ["pothole", "road", "street", "sidewalk", "bridge"],
        "Water": ["water", "leak", "pipe", "hydrant", "sewer"],
        "Electricity": ["power", "electric", "outage", "streetlight"],
        "Parks & Recreation": ["park", "playground", "trail"],
        "Healthcare": ["clinic", "hospital", "ambulance", "medical"],
    }
    hits = []
    for dept, keys in mapping.items():
        if any(k in joined for k in keys):
            hits.append(dept)
    return hits[:5]


def _summarize_cluster(texts: List[str], keywords: List[str]) -> str:
    if os.getenv("HF_TOKEN"):
        try:
            client = OpenAI(
                base_url="https://router.huggingface.co/v1",
                api_key=os.getenv("HF_TOKEN"),
            )
            system_prompt = (
                "You summarize civic complaint clusters. "
                "Return ONLY JSON with key: root_cause_summary."
            )
            response = client.chat.completions.create(
                model=os.getenv("HF_MODEL", "deepseek-ai/DeepSeek-V3-0324"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": (
                            "Summarize the root cause based on these keywords "
                            f"{keywords} and examples: {texts[:3]}"
                        ),
                    },
                ],
                temperature=0.2,
            )
            content = response.choices[0].message.content or ""
            data = _extract_json(content)
            return str(data.get("root_cause_summary", "")).strip()
        except Exception:
            pass

    return f"Likely root cause related to {', '.join(keywords[:3])}."


def build_root_cause_clusters(city: str, days: int, fallback_records: list | None = None):
    cutoff = datetime.utcnow() - timedelta(days=days)
    with SessionLocal() as session:
        query = session.query(IngestedComplaint).filter(
            IngestedComplaint.created_at >= cutoff
        )
        if city.lower() != "all":
            query = query.filter(IngestedComplaint.city == city)
        records = query.all()

    if not records and fallback_records:
        records = fallback_records
    if not records:
        return []

    def _get_text(r):
        return r.text if hasattr(r, "text") else r.get("description") or r.get("text", "")

    texts = [_get_text(r) for r in records]
    try:
        import hdbscan
        from sentence_transformers import SentenceTransformer
        from sklearn.feature_extraction.text import TfidfVectorizer
    except Exception:
        # If ML deps are missing, return a minimal summary instead of crashing.
        return [
            {
                "cluster_id": 0,
                "root_cause_summary": "Clustering dependencies are not installed. Please install scikit-learn, hdbscan, and sentence-transformers.",
                "top_keywords": [],
                "affected_departments": _infer_departments(texts),
                "example_complaints": texts[:3],
                "locations": [],
            }
        ]

    embedder = _get_embedder()
    embeddings = embedder.encode(texts, show_progress_bar=False)

    clusterer = hdbscan.HDBSCAN(min_cluster_size=3)
    labels = clusterer.fit_predict(embeddings)

    clusters = {}
    for idx, label in enumerate(labels):
        if label == -1:
            continue
        clusters.setdefault(label, []).append(idx)

    results = []
    for label, indices in clusters.items():
        cluster_texts = [texts[i] for i in indices]
        vectorizer = TfidfVectorizer(stop_words="english", max_features=15)
        tfidf = vectorizer.fit_transform(cluster_texts)
        keywords = vectorizer.get_feature_names_out().tolist()

        departments = _infer_departments(cluster_texts)
        locations = []
        for t in cluster_texts:
            locations.extend(_extract_locations(t))
        locations = list(dict.fromkeys(locations))[:5]

        summary = _summarize_cluster(cluster_texts, keywords)

        results.append(
            {
                "cluster_id": int(label),
                "root_cause_summary": summary,
                "top_keywords": keywords[:8],
                "affected_departments": departments,
                "example_complaints": cluster_texts[:3],
                "locations": locations,
            }
        )

    results.sort(key=lambda r: len(r["example_complaints"]), reverse=True)
    return results
