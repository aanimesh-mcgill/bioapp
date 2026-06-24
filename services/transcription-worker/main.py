"""Autobio transcription worker using faster-whisper (open-source Whisper)."""

import os
import re
import tempfile
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

# Arabic, Persian, Urdu, and related scripts Whisper may use for Hindi audio.
ARABIC_SCRIPT_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]")
DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")

HINDI_INITIAL_PROMPT = "यह हिंदी भाषा में बोला गया है। देवनागरी लिपि में लिखें।"

app = FastAPI(title="Autobio Transcription Worker")
model = None


def get_model():
    global model
    if model is None:
        from faster_whisper import WhisperModel
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


def resolve_language_hint(hint: str, hindi_output_mode: str) -> str | None:
    if hint == "en":
        return "en"
    if hint == "hi":
        return "hi"
    if hindi_output_mode == "hindi_script":
        return "hi"
    return None


def has_arabic_script(text: str) -> bool:
    return bool(ARABIC_SCRIPT_RE.search(text))


def has_devanagari(text: str) -> bool:
    return bool(DEVANAGARI_RE.search(text))


def to_devanagari_hindi(text: str) -> str:
    """Convert Urdu/Arabic-script Hindi output to Devanagari when possible."""
    if not text or not has_arabic_script(text):
        return text
    try:
        from aksharamukha.transliterate import process
        return process("Urdu", "Devanagari", text)
    except Exception:
        try:
            from aksharamukha import transliterate
            return transliterate.process("Urdu", "Devanagari", text)
        except Exception:
            return text


def ensure_hindi_devanagari(text: str, output_lang: str, hindi_output_mode: str) -> str:
    if hindi_output_mode != "hindi_script":
        return text
    if output_lang not in ("hi", "mixed"):
        return text
    if has_arabic_script(text):
        return to_devanagari_hindi(text)
    return text


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE, "loaded": model is not None}


@app.post("/transcribe", response_model=TranscribeResponse)
def transcribe(req: TranscribeRequest):
    try:
        with httpx.Client(timeout=120.0, follow_redirects=True) as client:
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
        lang = resolve_language_hint(req.language_hint, req.hindi_output_mode)
        initial_prompt = HINDI_INITIAL_PROMPT if req.hindi_output_mode == "hindi_script" else None

        segments, info = whisper.transcribe(
            tmp_path,
            language=lang,
            task="transcribe",
            vad_filter=True,
            beam_size=5,
            initial_prompt=initial_prompt,
        )

        text = " ".join(seg.text.strip() for seg in segments).strip()
        detected = info.language or "unknown"
        confidence = round(info.language_probability, 3) if info.language_probability else None

        output_lang = normalize_language(detected, req.language_hint)
        if req.hindi_output_mode == "hindi_script" and output_lang in ("mixed", "en") and has_devanagari(text):
            output_lang = "hi"

        text = ensure_hindi_devanagari(text, output_lang, req.hindi_output_mode)

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
