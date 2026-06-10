"""FastAPI entrypoint for the interview analysis backend."""

from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Logging must be initialised BEFORE any other local import so that
#    all module-level loggers inherit the correct configuration.
from core.logging_config import setup_logging

setup_logging(level=logging.INFO)

log = logging.getLogger(__name__)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from api.routes import router  # noqa: E402

app = FastAPI(
    title="AI Interview Simulator API",
    description="Backend API for multimodal interview performance analysis.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


# ─── Model warm-up ────────────────────────────────────────────────────────────
# All models are pre-loaded at startup so the first preflight request from the
# frontend always finds them already cached in memory.  This is especially
# important for large models like S-BERT (~500 MB) that can take several
# minutes to download on first run — far longer than the frontend's timeout.
#
# Strategy: run all loaders in a ThreadPoolExecutor so they execute in
# parallel without blocking the asyncio event loop.  Uvicorn starts accepting
# requests immediately; warm-up logs stream in the background.

def _warmup_one(name: str, loader: object) -> tuple[str, bool, float, str]:
    """Load one model.  Returns ``(name, success, elapsed_s, error_msg)``."""
    t0 = time.monotonic()
    try:
        loader()  # type: ignore[call-arg]
        elapsed = time.monotonic() - t0
        log.info("warm-up: [%-10s] ✓  ready in %5.1f s", name, elapsed)
        return name, True, elapsed, ""
    except Exception as exc:
        elapsed = time.monotonic() - t0
        log.error(
            "warm-up: [%-10s] ✗  FAILED after %5.1f s — %s: %s",
            name,
            elapsed,
            type(exc).__name__,
            exc,
            exc_info=True,
        )
        return name, False, elapsed, f"{type(exc).__name__}: {exc}"


async def _run_warmup() -> None:
    """Load all ML models concurrently in a thread pool."""
    # Import here to avoid circular imports at module level
    from ml_pipeline.audio.emotion import get_emotion_pipeline
    from ml_pipeline.text.scoring import get_sbert_model
    from ml_pipeline.text.transcription import get_transcription_pipeline
    from ml_pipeline.video.emotion import get_emotion_model, get_face_detector

    tasks = [
        ("elevenlabs",   get_transcription_pipeline),
        ("wav2vec2",  get_emotion_pipeline),
        ("sbert",     get_sbert_model),
        ("yolo-cls",  get_emotion_model),
        ("yolo-face", get_face_detector),
    ]

    log.info("─" * 60)
    log.info("warm-up: loading %d ML models in parallel …", len(tasks))
    log.info("  (first run may download weights — this can take minutes)")
    log.info("─" * 60)

    t_total = time.monotonic()
    loop = asyncio.get_running_loop()

    with ThreadPoolExecutor(
        max_workers=len(tasks),
        thread_name_prefix="warmup",
    ) as pool:
        futures = [
            loop.run_in_executor(pool, _warmup_one, name, loader)
            for name, loader in tasks
        ]
        results = await asyncio.gather(*futures, return_exceptions=False)

    ok    = [r for r in results if r[1]]
    fails = [r for r in results if not r[1]]
    total_s = time.monotonic() - t_total

    log.info("─" * 60)
    if fails:
        log.warning(
            "warm-up: %d/%d models FAILED: %s",
            len(fails),
            len(results),
            {r[0]: r[3] for r in fails},
        )
    log.info(
        "warm-up: done — %d/%d models ready  total=%.1f s",
        len(ok),
        len(results),
        total_s,
    )
    log.info("─" * 60)


@app.on_event("startup")
async def _on_startup() -> None:
    """Schedule the ML model warm-up as a background task.

    Uvicorn begins accepting HTTP requests immediately.  The warm-up task
    runs concurrently in the background.  By the time a user opens the
    preflight page (which requires navigating through the UI first), the
    models are almost certainly already loaded.
    """
    log.info("=" * 60)
    log.info("AI Interview Simulator API — starting")
    log.info("=" * 60)
    asyncio.create_task(_run_warmup(), name="model-warmup")
    log.info("API ready — model warm-up running in background")


@app.on_event("shutdown")
async def _on_shutdown() -> None:
    log.info("AI Interview Simulator API shutting down")


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Return a lightweight health check response."""
    log.debug("Health check requested")
    return {"status": "ok"}
