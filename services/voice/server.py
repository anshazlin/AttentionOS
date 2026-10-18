"""Private AttentionOS speech service: commercial-safe Kokoro; noncommercial OmniVoice."""
from __future__ import annotations

import base64
import hmac
import io
import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Literal

import numpy as np
import soundfile as sf
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="Private AttentionOS Voice", docs_url=None, redoc_url=None, openapi_url=None)

VOICE_TOKEN = os.getenv("VOICE_SERVER_TOKEN", "")
VOICE_ENABLE_OMNI = os.getenv("ENABLE_OMNIVOICE", "false").lower() == "true"
KOKORO_VOICES = {"bm_george", "bm_lewis", "bm_daniel"}


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    purpose: Literal["personal", "commercial"] = "personal"
    provider: Literal["auto", "kokoro", "omnivoice"] = "auto"
    voice: str = Field(default="", max_length=90)
    speed: float = Field(default=1.0, ge=0.75, le=1.3)
    # Personal-use only: voice reference audio supplied by the consenting speaker.
    reference_wav_base64: str | None = Field(default=None, max_length=1_800_000)
    reference_text: str | None = Field(default=None, max_length=400)
    consent_to_clone: bool = False


def authenticate(authorization: str | None) -> None:
    if not VOICE_TOKEN:
        raise HTTPException(status_code=503, detail="VOICE_SERVER_TOKEN is not configured")
    expected = "Bearer " + VOICE_TOKEN
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Voice server authentication required")


@lru_cache(maxsize=1)
def kokoro_model():
    try:
        from kokoro import KPipeline
    except ImportError:
        raise HTTPException(status_code=503, detail="Install the Kokoro inference dependencies")
    return KPipeline(lang_code="b")


@lru_cache(maxsize=1)
def omnivoice_model():
    if not VOICE_ENABLE_OMNI:
        raise HTTPException(status_code=503, detail="OmniVoice disabled. Explicitly enable on private hardware.")
    try:
        import torch
        from omnivoice import OmniVoice
    except ImportError:
        raise HTTPException(status_code=503, detail="OmniVoice dependencies are not installed")
    if torch.cuda.is_available():
        device, dtype = "cuda:0", torch.float16
    elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        device, dtype = "mps", torch.float32
    elif os.getenv("ALLOW_OMNIVOICE_CPU") == "true":
        device, dtype = "cpu", torch.float32
    else:
        raise HTTPException(status_code=503, detail="OmniVoice requires compatible compute; CPU requires explicit opt-in")
    # Important: these model weights have a NONCOMMERCIAL license.
    return OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map=device, dtype=dtype)


def synth_kokoro(body: SpeechRequest) -> np.ndarray:
    voice = body.voice or "bm_george"
    if voice not in KOKORO_VOICES:
        raise HTTPException(status_code=400, detail="Choose a supported British male Kokoro voice")
    generator = kokoro_model()(body.text, voice=voice, speed=body.speed)
    chunks = [np.asarray(audio, dtype=np.float32).reshape(-1) for _, _, audio in generator]
    if not chunks:
        raise HTTPException(status_code=502, detail="Kokoro produced no speech")
    return np.concatenate(chunks)


def synth_omni(body: SpeechRequest) -> np.ndarray:
    if body.purpose != "personal":
        raise HTTPException(status_code=403, detail="OmniVoice pretrained model is noncommercial; use Kokoro for brand content")
    model = omnivoice_model()
    if body.reference_wav_base64:
        if not body.consent_to_clone:
            raise HTTPException(status_code=403, detail="Explicit permission from voice owner is required")
        if not body.reference_text:
            raise HTTPException(status_code=400, detail="Provide a transcription of reference audio")
        try:
            content = base64.b64decode(body.reference_wav_base64, validate=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid WAV audio encoding")
        if not (1000 <= len(content) <= 1_300_000) or content[:4] != b"RIFF":
            raise HTTPException(status_code=400, detail="Provide a WAV sample under 1.3MB")
        reference = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                reference = Path(tmp.name)
                tmp.write(content)
            speech = model.generate(text=body.text, ref_audio=str(reference), ref_text=body.reference_text, speed=body.speed)
        finally:
            if reference:
                reference.unlink(missing_ok=True)
    else:
        # Voice-design instructions are permitted for personal/noncommercial use.
        voice_prompt = body.voice or "male, low pitch, british accent"
        if voice_prompt not in ("male, low pitch, british accent", "male, very low pitch, british accent"):
            raise HTTPException(status_code=400, detail="Unsupported OmniVoice preset")
        speech = model.generate(text=body.text, instruct=voice_prompt, speed=body.speed)
    if not speech or len(speech[0]) == 0:
        raise HTTPException(status_code=502, detail="OmniVoice produced no speech")
    return np.asarray(speech[0], dtype=np.float32).reshape(-1)


@app.get("/health")
def health(authorization: str | None = Header(default=None)):
    authenticate(authorization)
    return {
        "ok": True,
        "providers": ["kokoro"] + (["omnivoice"] if VOICE_ENABLE_OMNI else []),
        "loaded": {"kokoro": kokoro_model.cache_info().currsize > 0,
                   "omnivoice": omnivoice_model.cache_info().currsize > 0},
    }


@app.post("/v1/speak")
def speak(body: SpeechRequest, authorization: str | None = Header(default=None)):
    authenticate(authorization)
    provider = ("kokoro" if body.purpose == "commercial" else
                "omnivoice" if VOICE_ENABLE_OMNI else "kokoro") if body.provider == "auto" else body.provider
    if provider == "omnivoice" and body.purpose != "personal":
        raise HTTPException(status_code=403, detail="OmniVoice model weights cannot be used for commercial generation")
    if body.reference_wav_base64 and provider != "omnivoice":
        raise HTTPException(status_code=400, detail="Voice cloning is supported only with permitted OmniVoice usage")
    if provider == "omnivoice":
        samples = synth_omni(body)
    else:
        samples = synth_kokoro(body)
    if not np.isfinite(samples).all():
        raise HTTPException(status_code=502, detail="Audio contained invalid samples")
    with io.BytesIO() as buffer:
        sf.write(buffer, np.clip(samples, -1, 1), 24000, format="WAV", subtype="PCM_16")
        result = buffer.getvalue()
    if len(result) > 6_000_000:
        raise HTTPException(status_code=413, detail="Result too long; split the text into smaller segments")
    return Response(content=result, media_type="audio/wav", headers={"Cache-Control": "no-store",
                                                                     "X-Voice-Provider": provider})
