"""Autobio transcription worker using faster-whisper (open-source Whisper)."""

import os
import tempfile
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from faster_whisper import WhisperModel

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

app = FastAPI(title="Autobio Transcription Worker")
model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global model
    if model is None:
        model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    return model


class TranscribeRequest(BaseModel):
    audio_url: str
    language_hint: Literal["en", "hi", "mixed"] = "mixed"
    hindi_output_mode: Literal["hindi_script", "translate_english", "clean_mixed"] = "hindi_script"


class TranscribeResponse(BaseModel):
    text: str
    language: str
    detected_language: str
    english_translation: str | None = None
    confidence: float | None = None


def resolve_language_hint(hint: str) -> str | None:
    if hint == "en":
        return "en"
    if hint == "hi":
        return "hi"
    return None


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE}


@app.post("/transcribe", response_model=TranscribeResponse)
def transcribe(req: TranscribeRequest):
    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.get(req.audio_url)
            response.raise_for_status()
            audio_bytes = response.content
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to download audio: {e}") from e

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        whisper = get_model()
        lang = resolve_language_hint(req.language_hint)

        segments, info = whisper.transcribe(
            tmp_path,
            language=lang,
            task="transcribe",
            vad_filter=True,
            beam_size=5,
        )

        text = " ".join(seg.text.strip() for seg in segments).strip()
        detected = info.language or "unknown"
        confidence = round(info.language_probability, 3) if info.language_probability else None

        output_lang = normalize_language(detected, req.language_hint)
        english_translation = None

        if req.hindi_output_mode == "translate_english" and output_lang in ("hi", "mixed"):
            translate_segments, _ = whisper.transcribe(
                tmp_path,
                language="hi" if output_lang == "hi" else None,
                task="translate",
                vad_filter=True,
            )
            english_translation = " ".join(
                seg.text.strip() for seg in translate_segments
            ).strip()

        return TranscribeResponse(
            text=text,
            language=output_lang,
            detected_language=detected,
            english_translation=english_translation,
            confidence=confidence,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}") from e
    finally:
        os.unlink(tmp_path)


def normalize_language(detected: str, hint: str) -> str:
    if detected.startswith("hi"):
        return "hi"
    if detected.startswith("en"):
        return "en"
    if hint == "mixed":
        return "mixed"
    return hint
