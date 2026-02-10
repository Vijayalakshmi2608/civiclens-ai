import json
import os
from typing import List, Literal, Optional

from openai import OpenAI
from pydantic import BaseModel, Field

CATEGORY_LABELS = ["Water", "Electricity", "Roads", "Healthcare", "Police", "Sanitation"]


class AnalyzeRequest(BaseModel):
    text: Optional[str] = None
    description: Optional[str] = None


class AnalyzeResponse(BaseModel):
    category: Literal["Water", "Electricity", "Roads", "Healthcare", "Police", "Sanitation"]
    summary: str
    urgency_score: int = Field(ge=1, le=5)


class CityReportRequest(BaseModel):
    city: str = Field(min_length=2)


class CityReportResponse(BaseModel):
    key_issues: list[str]
    root_causes: list[str]
    recommended_actions: list[str]


class DepartmentCoachingRequest(BaseModel):
    department_name: str
    total_complaints: int
    avg_resolution_hours: float
    reopen_rate: float
    sentiment_score: float


class DepartmentCoachingReport(BaseModel):
    strengths: list[str]
    weaknesses: list[str]
    priority_fixes: list[str]
    process_improvements: list[str]


def _heuristic_analyze(text: str) -> AnalyzeResponse:
    text_lower = text.lower()
    category = "Roads"
    keyword_map = {
        "Water": ["water", "leak", "flood", "sewer", "hydrant", "pipe"],
        "Electricity": ["power", "electric", "outage", "transformer", "streetlight", "lights"],
        "Roads": ["pothole", "road", "street", "traffic", "bridge", "sidewalk"],
        "Healthcare": ["clinic", "hospital", "ambulance", "medical", "health"],
        "Police": ["police", "crime", "theft", "assault", "safety", "patrol"],
        "Sanitation": ["trash", "garbage", "waste", "pickup", "dump", "recycling"],
    }
    for label, keys in keyword_map.items():
        if any(k in text_lower for k in keys):
            category = label
            break

    urgency_score = 3
    if any(k in text_lower for k in ["danger", "injury", "urgent", "emergency", "unsafe"]):
        urgency_score = 5
    elif any(k in text_lower for k in ["soon", "accident", "blocking", "flood", "outage"]):
        urgency_score = 4
    elif len(text) < 40:
        urgency_score = 2

    summary = " ".join(text.strip().split())
    if len(summary) > 140:
        summary = summary[:140].rstrip() + "..."

    return AnalyzeResponse(category=category, summary=summary, urgency_score=urgency_score)


def _extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start : end + 1])

    raise ValueError("No JSON object found in model response.")


def _hf_analyze(text: str) -> AnalyzeResponse:
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise RuntimeError("HF_TOKEN not set.")

    client = OpenAI(
        base_url="https://router.huggingface.co/v1",
        api_key=hf_token,
    )

    system_prompt = (
        "You are a civic complaint triage assistant. "
        "Return ONLY a JSON object with keys: category, summary, urgency_score. "
        f"category must be one of: {CATEGORY_LABELS}. "
        "summary must be a single line. urgency_score must be an integer 1-5."
    )

    response = client.chat.completions.create(
        model=os.getenv("HF_MODEL", "deepseek-ai/DeepSeek-V3-0324"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        temperature=0.2,
    )

    content = response.choices[0].message.content or ""
    data = _extract_json(content)

    category = data.get("category", "Roads")
    if category not in CATEGORY_LABELS:
        category = "Roads"

    summary = str(data.get("summary", "")).strip()
    urgency_score = int(data.get("urgency_score", 3))
    urgency_score = max(1, min(5, urgency_score))

    return AnalyzeResponse(category=category, summary=summary, urgency_score=urgency_score)


def analyze_complaint(payload: AnalyzeRequest) -> AnalyzeResponse:
    raw_text = payload.text or payload.description or ""
    text = raw_text.strip()
    if not text:
        return _heuristic_analyze("No details provided.")

    if os.getenv("HF_TOKEN"):
        try:
            return _hf_analyze(text)
        except Exception:
            return _heuristic_analyze(text)

    return _heuristic_analyze(text)


def _heuristic_city_report(city: str) -> CityReportResponse:
    city = city.strip()
    return CityReportResponse(
        key_issues=[
            f"Rising complaints in core infrastructure services in {city}.",
            "High-urgency incidents clustered around public safety and utilities.",
        ],
        root_causes=[
            "Maintenance backlog and aging infrastructure.",
            "Uneven staffing coverage across high-demand neighborhoods.",
        ],
        recommended_actions=[
            "Prioritize top 3 issue categories for rapid-response crews.",
            "Increase preventative maintenance in high-incident zones.",
            "Coordinate cross-department triage for urgent cases.",
        ],
    )


def generate_city_report(city: str, context: dict | None = None) -> CityReportResponse:
    if os.getenv("HF_TOKEN"):
        try:
            client = OpenAI(
                base_url="https://router.huggingface.co/v1",
                api_key=os.getenv("HF_TOKEN"),
            )
            system_prompt = (
                "You are an executive analyst for a civic operations dashboard. "
                "Return ONLY JSON with keys: key_issues, root_causes, recommended_actions. "
                "Each value must be an array of 2-4 short bullet strings."
            )
            context_text = json.dumps(context or {}, ensure_ascii=False)
            response = client.chat.completions.create(
                model=os.getenv("HF_MODEL", "deepseek-ai/DeepSeek-V3-0324"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"Generate a report for {city}. Use this context: {context_text}",
                    },
                ],
                temperature=0.2,
            )
            content = response.choices[0].message.content or ""
            data = _extract_json(content)
            return CityReportResponse(
                key_issues=list(data.get("key_issues", [])),
                root_causes=list(data.get("root_causes", [])),
                recommended_actions=list(data.get("recommended_actions", [])),
            )
        except Exception:
            return _heuristic_city_report(city)

    return _heuristic_city_report(city)


def _heuristic_department_report(dept: str, stats: DepartmentCoachingRequest) -> DepartmentCoachingReport:
    return DepartmentCoachingReport(
        strengths=[
            f"{dept} handles a steady volume with consistent resolution pacing.",
            "Recent triage suggests improving responsiveness to urgent cases.",
        ],
        weaknesses=[
            "Reopen rate indicates recurring issues that may lack root-cause fixes.",
            "Sentiment score suggests resident frustration with follow-through.",
        ],
        priority_fixes=[
            "Target the top 2 complaint categories for rapid remediation.",
            "Reduce repeat incidents with preventative maintenance checks.",
        ],
        process_improvements=[
            "Introduce weekly backlog reviews with escalation triggers.",
            "Standardize response playbooks for high-urgency complaints.",
        ],
    )


def generate_department_coaching(stats: DepartmentCoachingRequest) -> DepartmentCoachingReport:
    if os.getenv("HF_TOKEN"):
        try:
            client = OpenAI(
                base_url="https://router.huggingface.co/v1",
                api_key=os.getenv("HF_TOKEN"),
            )
            system_prompt = (
                "You are a civic operations coach. "
                "Return ONLY JSON with keys: strengths, weaknesses, priority_fixes, process_improvements. "
                "Each value must be an array of 2-4 short bullet strings."
            )
            response = client.chat.completions.create(
                model=os.getenv("HF_MODEL", "deepseek-ai/DeepSeek-V3-0324"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": (
                            "Create a coaching report for this department based on stats: "
                            f"{stats.model_dump()}"
                        ),
                    },
                ],
                temperature=0.2,
            )
            content = response.choices[0].message.content or ""
            data = _extract_json(content)
            return DepartmentCoachingReport(
                strengths=list(data.get("strengths", [])),
                weaknesses=list(data.get("weaknesses", [])),
                priority_fixes=list(data.get("priority_fixes", [])),
                process_improvements=list(data.get("process_improvements", [])),
            )
        except Exception:
            return _heuristic_department_report(stats.department_name, stats)

    return _heuristic_department_report(stats.department_name, stats)
