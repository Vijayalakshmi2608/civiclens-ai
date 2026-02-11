import os
import re
from datetime import datetime, timedelta
from typing import Any, List

from sqlalchemy.exc import OperationalError
from .analysis import _extract_json
from .db import IngestedComplaint, SessionLocal
from openai import OpenAI

_EMBEDDER: Any = None


def _get_embedder():
    global _EMBEDDER
    if _EMBEDDER is None:
        from sentence_transformers import SentenceTransformer
        _EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2")
    return _EMBEDDER


def _extract_locations(text: str) -> List[str]:
    patterns = re.findall(
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Park|Bridge)",
        text,
    )
    return list({f"{name} {suffix}" for name, suffix in patterns})


def _infer_departments(texts: List[str]) -> List[str]:
    joined = " ".join(texts).lower()
    mapping = {
        "Police": ["police", "crime", "patrol", "theft", "assault", "fight", "noise", "banging", "pounding"],
        "Sanitation": ["trash", "garbage", "waste", "recycling", "rats", "rodent", "litter", "debris"],
        "Public Works": ["pothole", "road", "street", "sidewalk", "bridge", "sign", "traffic signal"],
        "Buildings": ["construction", "building", "permit", "illegal work", "scaffold", "boiler", "elevator"],
        "Transportation": ["bus", "subway", "transit", "parking", "crosswalk", "bike lane"],
        "Water": ["water", "leak", "pipe", "hydrant", "sewer"],
        "Electricity": ["power", "electric", "outage", "streetlight"],
        "Parks & Recreation": ["park", "playground", "trail"],
        "Healthcare": ["clinic", "hospital", "ambulance", "medical"],
    }
    hits = []
    for dept, keys in mapping.items():
        if any(k in joined for k in keys):
            hits.append(dept)
    if not hits:
        return ["City Services"]
    return hits[:5]


def _single_cluster_response(texts: List[str], vectorizer_cls: Any) -> list:
    keywords: List[str] = []
    try:
        vectorizer = vectorizer_cls(stop_words="english", max_features=8)
        vectorizer.fit(texts)
        keywords = vectorizer.get_feature_names_out().tolist()
    except Exception:
        keywords = []

    return [
        {
            "cluster_id": 0,
            "root_cause_summary": _summarize_cluster(texts, keywords),
            "top_keywords": keywords,
            "affected_departments": _infer_departments(texts),
            "example_complaints": texts[:3],
            "locations": list(dict.fromkeys(sum([_extract_locations(t) for t in texts], [])))[:5],
        }
    ]


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
    try:
        with SessionLocal() as session:
            query = session.query(IngestedComplaint).filter(
                IngestedComplaint.created_at >= cutoff
            )
            if city.lower() != "all":
                query = query.filter(IngestedComplaint.city == city)
            records = query.all()
    except OperationalError:
        records = []

    if not records and fallback_records:
        records = fallback_records
    if not records:
        return []

    def _get_text(r):
        return r.text if hasattr(r, "text") else r.get("description") or r.get("text", "")

    texts = [_get_text(r) for r in records]
    n_samples = len(texts)
    if n_samples == 0:
        return []

    try:
        import hdbscan
        from sklearn.feature_extraction.text import TfidfVectorizer
    except Exception:
        # If ML deps are missing, return a minimal summary instead of crashing.
        fallback = _single_cluster_response(texts, lambda **_: None)
        fallback[0]["root_cause_summary"] = (
            "Clustering dependencies are not installed. Please install scikit-learn, "
            "hdbscan, and sentence-transformers."
        )
        fallback[0]["top_keywords"] = []
        fallback[0]["locations"] = []
        return fallback

    # HDBSCAN fails for very small sample sizes; return a deterministic fallback.
    if n_samples < 3:
        return _single_cluster_response(texts, TfidfVectorizer)

    embedder = _get_embedder()
    embeddings = embedder.encode(texts, show_progress_bar=False)
    vector_n = len(embeddings)
    if vector_n < 3:
        return _single_cluster_response(texts, TfidfVectorizer)

    min_cluster_size = min(5, max(2, vector_n // 2))
    min_samples = max(1, min(2, vector_n - 1))
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
    )
    try:
        labels = clusterer.fit_predict(embeddings)
    except Exception:
        # Safe fallback if clustering fails unexpectedly.
        return _single_cluster_response(texts, TfidfVectorizer)

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

    if not results:
        # If everything is marked as noise (-1), return a fallback summary.
        return _single_cluster_response(texts, TfidfVectorizer)

    results.sort(key=lambda r: len(r["example_complaints"]), reverse=True)
    return results
