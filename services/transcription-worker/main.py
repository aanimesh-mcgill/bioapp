"""Autobio transcription worker using faster-whisper (open-source Whisper)."""

import os
import re
import tempfile
import threading
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
LATIN_RE = re.compile(r"[A-Za-z]")

# Whisper often echoes initial_prompt into short clips — do not pass Hindi instruction text.
WHISPER_PROMPT_LEAKAGE = [
    re.compile(r"यह\s+हिंदी\s+भाषा\s+में\s+बोला\s+गया\s+है[।\.]?\s*", re.IGNORECASE),
    re.compile(r"देवनागरी\s+लिपि\s+में\s+लिखें[।\.]?\s*", re.IGNORECASE),
    re.compile(r"(?:भाषा\s+में\s*)+लिखें[।\.]?\s*", re.IGNORECASE),
    re.compile(r"में\s+भाषा\s+में\s+"),
    re.compile(r"^[\s।\.]+|[\s।\.]+$"),
]

model = None
_model_lock = threading.Lock()


def _preload_model() -> None:
    try:
        get_model()
    except Exception as exc:
        print(f"Whisper preload failed: {exc}", flush=True)


def get_model():
    global model
    if model is None:
        with _model_lock:
            if model is None:
                from faster_whisper import WhisperModel
                model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    return model


app = FastAPI(title="Autobio Transcription Worker")
threading.Thread(target=_preload_model, daemon=True).start()


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
    """Whisper language code, or None to auto-detect (needed for Hinglish / code-switching)."""
    if hint == "en":
        return "en"
    if hint == "hi":
        return "hi"
    return None


def infer_transcript_language(text: str, detected: str, hint: str) -> str:
    """Classify transcript as en, hi, or mixed from script + detection."""
    has_dev = has_devanagari(text)
    has_latin = bool(LATIN_RE.search(text))
    if has_dev and has_latin:
        return "mixed"
    if has_dev:
        return "hi"
    if has_latin:
        return "en"
    if hint == "mixed":
        return "mixed"
    return normalize_language(detected, hint)


def has_arabic_script(text: str) -> bool:
    return bool(ARABIC_SCRIPT_RE.search(text))


def has_devanagari(text: str) -> bool:
    return bool(DEVANAGARI_RE.search(text))


def sanitize_whisper_text(text: str) -> str:
    """Remove known Whisper prompt-echo and instruction hallucinations."""
    if not text:
        return text
    cleaned = text.strip()
    for pattern in WHISPER_PROMPT_LEAKAGE:
        cleaned = pattern.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" \t\n.,;।")
    return cleaned


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
    loaded = model is not None
    if not loaded:
        try:
            get_model()
            loaded = model is not None
        except Exception:
            pass
    return {"status": "ok" if loaded else "starting", "model": MODEL_SIZE, "loaded": loaded}


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
        lang = resolve_language_hint(req.language_hint)

        segments, info = whisper.transcribe(
            tmp_path,
            language=lang,
            task="transcribe",
            vad_filter=True,
            beam_size=5,
            condition_on_previous_text=False,
        )

        text = sanitize_whisper_text(" ".join(seg.text.strip() for seg in segments).strip())
        detected = info.language or "unknown"
        confidence = round(info.language_probability, 3) if info.language_probability else None

        output_lang = infer_transcript_language(text, detected, req.language_hint)
        if (
            req.hindi_output_mode == "hindi_script"
            and output_lang == "en"
            and has_devanagari(text)
        ):
            output_lang = "hi" if not LATIN_RE.search(text) else "mixed"

        text = ensure_hindi_devanagari(text, output_lang, req.hindi_output_mode)

        english_translation = None

        if req.hindi_output_mode == "translate_english" and output_lang in ("hi", "mixed"):
            translate_lang = None if output_lang == "mixed" else "hi"
            translate_segments, _ = whisper.transcribe(
                tmp_path,
                language=translate_lang,
                task="translate",
                vad_filter=True,
                condition_on_previous_text=False,
            )
            english_translation = sanitize_whisper_text(
                " ".join(seg.text.strip() for seg in translate_segments).strip()
            )

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
