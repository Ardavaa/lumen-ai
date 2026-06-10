"""Central configuration for models, scoring weights, and analysis thresholds."""

import os
from pathlib import Path
from typing import Final

# ─── Upload and extraction limits ────────────────────────────────────────────

MAX_UPLOAD_BYTES: Final[int] = 5000 * 1024 * 1024 # 5GB
MAX_FRAME_UPLOAD_BYTES: Final[int] = 500 * 1024 * 1024
FFMPEG_TIMEOUT_SEC: Final[float] = 60.0

# ─── Recording duration quality thresholds ────────────────────────────────────
# Recordings shorter than this are considered too short to produce reliable scores.
# A linear penalty is applied between 0 and MIN_DURATION_FULL_SCORE_SEC.
# Below DURATION_FLOOR_SEC the score is hard-capped regardless.
MIN_DURATION_FULL_SCORE_SEC: Final[float] = 30.0   # below this → penalty begins
DURATION_FLOOR_SEC: Final[float] = 5.0             # below this → hard cap at 20
DURATION_HARD_CAP_SCORE: Final[int] = 20           # maximum score when below floor
ALLOWED_UPLOAD_EXTENSIONS: Final[frozenset[str]] = frozenset(
    {".mp4", ".mov", ".m4v", ".webm", ".wav", ".mp3", ".m4a", ".aac", ".ogg"},
)
ALLOWED_UPLOAD_MIME_TYPES: Final[frozenset[str]] = frozenset(
    {
        "video/mp4",
        "video/quicktime",
        "video/x-m4v",
        "video/webm",
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
        "audio/mpeg",
        "audio/mp4",
        "audio/aac",
        "audio/ogg",
    },
)
ALLOWED_FRAME_MIME_TYPES: Final[frozenset[str]] = frozenset({"image/jpeg", "image/png"})

# ─── Model IDs ───────────────────────────────────────────────────────────────

GROQ_API_KEY: Final[str] = os.environ.get("GROQ_API_KEY", "")
GROQ_STT_MODEL_ID: Final[str] = "whisper-large-v3-turbo"
EMBEDDING_MODEL_ID: Final[str] = "intfloat/multilingual-e5-base"
CROSS_ENCODER_MODEL_ID: Final[str] = "cross-encoder/mmarco-mMiniLM-L-12-v2"
# Legacy alias — preflight route key remains ``sbert``.
SBERT_MODEL_ID: Final[str] = EMBEDDING_MODEL_ID

# Composite content score: semantic + rubric coverage + completeness/STAR.
CONTENT_WEIGHT_SEMANTIC: Final[float] = 0.50
CONTENT_WEIGHT_RUBRIC: Final[float] = 0.30
CONTENT_WEIGHT_COMPLETENESS: Final[float] = 0.20
CONTENT_SEMANTIC_CROSS_BLEND: Final[float] = 0.60
CONTENT_CROSS_ENCODER_BLEND: Final[float] = 0.40
EMOTION_MODEL_ID: Final[str] = "superb/wav2vec2-base-superb-er"

# ─── Voice emotion (SER) ─────────────────────────────────────────────────────

EMOTION_SAMPLE_RATE: Final[int] = 16000
EMOTION_CHUNK_SEC: Final[float] = 3.0
EMOTION_MIN_CHUNK_SEC: Final[float] = 1.0
EMOTION_DELIVERY_BLEND_WEIGHT: Final[float] = 0.25

# ─── Fusion weights (must sum to 1.0) ────────────────────────────────────────

WEIGHT_CONTENT: Final[float] = 0.40
WEIGHT_DELIVERY: Final[float] = 0.30
WEIGHT_NON_VERBAL: Final[float] = 0.30

# ─── Delivery analysis ───────────────────────────────────────────────────────

_FILLER_FALLBACK: Final[tuple[str, ...]] = (
    "um",
    "uh",
    "er",
    "ah",
    "eh",
    "hmm",
    "hm",
    "kinda",
    "you know",
    "basically",
    "jadi",
    "gitu",
    "kan",
    "ya",
    "nah",
    "anu",
)


def _load_filler_words() -> tuple[str, ...]:
    """Load filler phrases from ``ml_pipeline/audio/filler.txt`` (comma-separated)."""

    path = (
        Path(__file__).resolve().parent.parent
        / "ml_pipeline"
        / "audio"
        / "filler.txt"
    )
    try:
        text = path.read_text(encoding="utf-8")
        seen: set[str] = set()
        words: list[str] = []
        for raw in text.split(","):
            word = raw.strip().lower()
            if word and word not in seen:
                seen.add(word)
                words.append(word)
        if words:
            return tuple(sorted(words, key=len, reverse=True))
    except OSError:
        pass
    return _FILLER_FALLBACK


FILLER_WORDS: Final[tuple[str, ...]] = _load_filler_words()

IDEAL_WPM: Final[float] = 140.0
WPM_TOLERANCE: Final[float] = 60.0

# Pause detection (librosa.effects.split top_db)
PAUSE_TOP_DB: Final[int] = 30

# ─── HuggingFace local model cache ───────────────────────────────────────────
# All downloaded model weights are stored here so they persist across
# venv rebuilds and never require re-downloading from the internet.
# Must be set via env-var BEFORE transformers/sentence-transformers are imported.

import os as _os

HF_CACHE_DIR: Final[Path] = Path(__file__).resolve().parent.parent / ".hf_cache"
HF_CACHE_DIR.mkdir(exist_ok=True)

_os.environ.setdefault("HF_HOME", str(HF_CACHE_DIR))
_os.environ.setdefault("TRANSFORMERS_CACHE", str(HF_CACHE_DIR / "hub"))
_os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", str(HF_CACHE_DIR / "sentence_transformers"))

# ─── Video emotion (facial expression) ──────────────────────────────────────

VIDEO_EMOTION_MODEL_PATH: Final[Path] = (
    Path(__file__).resolve().parent.parent
    / "ml_pipeline"
    / "video"
    / "models"
    / "best.pt"
)

# YOLOv8n face detection model (task=detect, class=FACE).
# Replaces the Haar cascade — produces stable, accurate face bounding boxes.
VIDEO_FACE_DETECTOR_MODEL_PATH: Final[Path] = (
    Path(__file__).resolve().parent.parent
    / "ml_pipeline"
    / "video"
    / "models"
    / "yolov8n-face.pt"
)

VIDEO_FRAME_SAMPLE_FPS: Final[float] = 1.0
VIDEO_FACE_DETECTION_CONFIDENCE: Final[float] = 0.5

# ─── Default topic when client omits question_topic ───────────────────────────

DEFAULT_QUESTION_TOPIC: Final[str] = (
    "technical interview software engineering problem solving communication"
)
