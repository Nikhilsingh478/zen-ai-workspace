"""
JARVIS local TTS sidecar — Chatterbox (Resemble AI, MIT licence).
https://github.com/resemble-ai/chatterbox

Loads the model once at startup and serves speech for the JARVIS web app:

    GET  /health  -> {"status": "ready", "model": ..., "device": ..., "sample_rate": ...}
    POST /tts     -> audio/wav   body: {"text": "...", optional per-request overrides}

All settings come from environment variables (see README.md). Generation runs
on a worker thread behind a lock: the GPU model is not re-entrant, and the
event loop stays free to answer /health while a sentence is being generated.
"""

from __future__ import annotations

import io
import logging
import os
import threading
import time
import wave
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

logging.basicConfig(level=logging.INFO, format="%(asctime)s [tts] %(message)s")
log = logging.getLogger("jarvis-tts")


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


# ─── Configuration ────────────────────────────────────────────────────────────

MODEL_NAME = os.environ.get("CHATTERBOX_MODEL", "turbo").lower()  # turbo | original
DEVICE_PREF = os.environ.get("CHATTERBOX_DEVICE", "auto").lower()  # auto | cuda | cpu
VOICE_PATH = os.environ.get("CHATTERBOX_VOICE", "").strip()  # optional reference clip (>5s) for cloning
HOST = os.environ.get("CHATTERBOX_HOST", "127.0.0.1")
PORT = int(os.environ.get("CHATTERBOX_PORT", "8765"))
MAX_CHARS = int(os.environ.get("CHATTERBOX_MAX_CHARS", "600"))
# Browser origins allowed to call the server. Default: any localhost port.
ALLOWED_ORIGIN_REGEX = os.environ.get(
    "CHATTERBOX_ALLOWED_ORIGIN_REGEX", r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
)

DEFAULTS = {
    # Turbo sampling controls
    "temperature": _env_float("CHATTERBOX_TEMPERATURE", 0.8),
    "top_p": _env_float("CHATTERBOX_TOP_P", 0.95),
    "top_k": int(_env_float("CHATTERBOX_TOP_K", 1000)),
    "repetition_penalty": _env_float("CHATTERBOX_REPETITION_PENALTY", 1.2),
    # Original-model expressiveness controls (ignored by Turbo)
    "exaggeration": _env_float("CHATTERBOX_EXAGGERATION", 0.5),
    "cfg_weight": _env_float("CHATTERBOX_CFG_WEIGHT", 0.5),
}


# ─── Model ────────────────────────────────────────────────────────────────────

class Engine:
    def __init__(self) -> None:
        self.model = None
        self.device = "cpu"
        self.sample_rate = 24000
        self.error: Optional[str] = None
        self.lock = threading.Lock()

    def load(self) -> None:
        if DEVICE_PREF == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = DEVICE_PREF
        log.info("Loading Chatterbox %s on %s ...", MODEL_NAME, self.device)
        started = time.perf_counter()

        if MODEL_NAME == "turbo":
            from chatterbox.tts_turbo import ChatterboxTurboTTS

            self.model = ChatterboxTurboTTS.from_pretrained(device=self.device)
        elif MODEL_NAME == "original":
            from chatterbox.tts import ChatterboxTTS

            self.model = ChatterboxTTS.from_pretrained(device=self.device)
        else:
            raise ValueError(f"Unknown CHATTERBOX_MODEL '{MODEL_NAME}' (use turbo or original)")

        self.sample_rate = int(self.model.sr)

        # Voice cloning: prepare the reference clip ONCE, so every request
        # reuses the cached conditionals instead of re-encoding the clip.
        if VOICE_PATH:
            if not os.path.isfile(VOICE_PATH):
                raise FileNotFoundError(f"CHATTERBOX_VOICE not found: {VOICE_PATH}")
            log.info("Preparing reference voice from %s", VOICE_PATH)
            if MODEL_NAME == "original":
                self.model.prepare_conditionals(VOICE_PATH, exaggeration=DEFAULTS["exaggeration"])
            else:
                self.model.prepare_conditionals(VOICE_PATH)
        elif getattr(self.model, "conds", None) is None:
            raise RuntimeError("This checkpoint has no built-in voice — set CHATTERBOX_VOICE to a >5s reference clip")

        log.info("Model loaded in %.1fs (sample rate %d)", time.perf_counter() - started, self.sample_rate)

        # Warm-up: the first generation compiles CUDA kernels and is much slower.
        started = time.perf_counter()
        self.synthesize("JARVIS online.", {})
        log.info("Warm-up done in %.1fs", time.perf_counter() - started)

    def synthesize(self, text: str, overrides: dict) -> bytes:
        opts = {**DEFAULTS, **{k: v for k, v in overrides.items() if v is not None}}
        with self.lock, torch.inference_mode():
            if MODEL_NAME == "original":
                wav = self.model.generate(
                    text,
                    exaggeration=opts["exaggeration"],
                    cfg_weight=opts["cfg_weight"],
                    temperature=opts["temperature"],
                )
            else:
                wav = self.model.generate(
                    text,
                    temperature=opts["temperature"],
                    top_p=opts["top_p"],
                    top_k=opts["top_k"],
                    repetition_penalty=opts["repetition_penalty"],
                )
        return _to_wav_bytes(wav, self.sample_rate)


def _to_wav_bytes(wav: torch.Tensor, sample_rate: int) -> bytes:
    """(1, N) float tensor in [-1, 1] -> 16-bit mono PCM WAV bytes."""
    samples = wav.squeeze().detach().cpu().float().numpy()
    pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


engine = Engine()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        await run_in_threadpool(engine.load)
    except Exception as exc:  # keep serving /health so the app can see why
        engine.error = f"{type(exc).__name__}: {exc}"
        log.exception("Failed to load Chatterbox — JARVIS will fall back to browser speech")
    yield


app = FastAPI(title="JARVIS TTS (Chatterbox)", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1)
    temperature: Optional[float] = Field(None, ge=0.05, le=2.0)
    top_p: Optional[float] = Field(None, gt=0.0, le=1.0)
    top_k: Optional[int] = Field(None, ge=1)
    repetition_penalty: Optional[float] = Field(None, ge=1.0, le=2.0)
    exaggeration: Optional[float] = Field(None, ge=0.0, le=2.0)
    cfg_weight: Optional[float] = Field(None, ge=0.0, le=1.0)


@app.get("/health")
def health():
    if engine.error:
        return {"status": "error", "error": engine.error}
    if engine.model is None:
        return {"status": "loading"}
    return {
        "status": "ready",
        "model": MODEL_NAME,
        "device": engine.device,
        "sample_rate": engine.sample_rate,
        "voice": "custom" if VOICE_PATH else "default",
    }


@app.post("/tts")
async def tts(req: TTSRequest):
    if engine.model is None:
        raise HTTPException(503, detail=engine.error or "Model is still loading")
    text = req.text.strip()
    if len(text) > MAX_CHARS:
        raise HTTPException(413, detail=f"Text longer than {MAX_CHARS} characters — send one sentence at a time")

    started = time.perf_counter()
    try:
        audio = await run_in_threadpool(engine.synthesize, text, req.model_dump(exclude={"text"}))
    except Exception as exc:
        log.exception("Generation failed")
        raise HTTPException(500, detail=f"Generation failed: {exc}") from exc

    gen_s = time.perf_counter() - started
    audio_s = (len(audio) - 44) / 2 / engine.sample_rate
    log.info("%.2fs audio in %.2fs (RTF %.2f): %s", audio_s, gen_s, gen_s / max(audio_s, 1e-6), text[:60])
    return Response(content=audio, media_type="audio/wav", headers={"X-Generation-Seconds": f"{gen_s:.3f}"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
