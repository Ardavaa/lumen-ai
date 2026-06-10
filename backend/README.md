---
title: Lumen AI Backend
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# Backend Setup

This backend is managed with `uv` and currently keeps the existing Python constraint from `pyproject.toml`.

## Initialize the Environment

From the `backend` directory:

```bash
uv venv
```

Activate the virtual environment:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1

# Git Bash
source .venv/Scripts/activate
```

Install the locked dependencies:

```bash
uv sync
```

Optionally copy the environment sample before local runs:

```bash
cp .env.example .env
```

## Export `requirements.txt`

When dependencies change through `uv add`, regenerate `requirements.txt` with:

```bash
uv export --format requirements-txt --no-hashes --output-file requirements.txt
```

The current `requirements.txt` was generated from the existing `uv.lock`.

## Run the API

```bash
uv run uvicorn main:app --reload --port 8000
```

Requires `ffmpeg` on PATH for media uploads.

## Analyze Endpoint

`POST /api/analyze` (multipart form):

| Field | Type | Required |
|-------|------|----------|
| `file` | video/audio file | yes |
| `question_topic` | string | no (defaults to technical interview topic) |

Pipeline: **ffmpeg** → **Whisper** → delivery metrics (WPM, fillers, pauses) → **voice emotion (SER)** → **S-BERT** content score → **video facial emotion (YOLOv8-cls + MediaPipe face detection)** → weighted fusion **40/30/30**.

Example response fields: `final_score`, `content_score`, `delivery_score`, `non_verbal_score`, `transcription`, `delivery_metrics`, `emotion_metrics`, `video_emotion_metrics`, `feedback`.

`emotion_metrics` includes `dominant_emotion`, `emotion_distribution`, `stability_score`, `nervous_rate`, `emotion_score`, and `chunks_analyzed`. Delivery score blends fluency (75%) with voice emotion (25%).

`video_emotion_metrics` includes `dominant_emotion`, `emotion_distribution`, `stability_score`, `nervous_rate`, `non_verbal_score`, `frames_analyzed`, and `frames_sampled`. The YOLOv8-cls weights live at `backend/ml_pipeline/video/models/best.pt`.

## Local Cache and Tooling

Downloaded Hugging Face models are cached under `backend/.hf_cache/`. That directory is generated at runtime and ignored by Git; the first model load restores it automatically.

Run lightweight backend checks from this directory with:

```bash
uvx ruff check .
uvx pytest
```
