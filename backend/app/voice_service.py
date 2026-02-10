import os
import tempfile
from typing import Tuple

from fastapi import UploadFile

from .analysis import AnalyzeRequest, analyze_complaint


def _hf_asr_transcribe(file_path: str) -> Tuple[str, str]:
    """
    Uses Hugging Face Inference (OpenAI-compatible via router) if available.
    Returns (language, text).
    """
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        return "unknown", ""

    # Use whisper-large-v3-turbo for multilingual ASR
    from openai import OpenAI

    client = OpenAI(base_url="https://router.huggingface.co/v1", api_key=hf_token)
    with open(file_path, "rb") as f:
        resp = client.audio.transcriptions.create(
            model=os.getenv("HF_ASR_MODEL", "openai/whisper-large-v3-turbo"),
            file=f,
        )

    # HF router returns text only; language may be unavailable
    return "unknown", resp.text or ""


def transcribe_audio(upload: UploadFile) -> Tuple[str, str]:
    suffix = os.path.splitext(upload.filename or "")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = upload.file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        language, text = _hf_asr_transcribe(tmp_path)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    return language, text


def translate_to_english(text: str, language: str) -> str:
    if not text.strip():
        return ""
    if language in ("en", "english"):
        return text

    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        return text

    from openai import OpenAI

    client = OpenAI(base_url="https://router.huggingface.co/v1", api_key=hf_token)
    response = client.chat.completions.create(
        model=os.getenv("HF_MODEL", "deepseek-ai/DeepSeek-V3-0324"),
        messages=[
            {"role": "system", "content": "Translate the text to English only."},
            {"role": "user", "content": text},
        ],
        temperature=0.2,
    )

    return response.choices[0].message.content or text


def analyze_voice_text(text: str):
    return analyze_complaint(AnalyzeRequest(text=text))
