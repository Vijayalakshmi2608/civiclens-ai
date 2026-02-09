from dataclasses import dataclass

from .db import IngestedComplaint, SessionLocal
from .main import AnalyzeRequest, analyze_complaint


@dataclass
class IngestResult:
    id: int
    category: str
    summary: str
    urgency_score: int


def ingest_post(source: str, text: str) -> IngestResult:
    analysis = analyze_complaint(AnalyzeRequest(text=text))

    with SessionLocal() as session:
        record = IngestedComplaint(
            source=source,
            text=text,
            category=analysis.category,
            summary=analysis.summary,
            urgency_score=analysis.urgency_score,
        )
        session.add(record)
        session.commit()
        session.refresh(record)

    return IngestResult(
        id=record.id,
        category=record.category,
        summary=record.summary,
        urgency_score=record.urgency_score,
    )
