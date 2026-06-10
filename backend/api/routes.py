"""FastAPI routes for interview analysis."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from anyio import to_thread
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
import httpx

import time

log = logging.getLogger(__name__)

from api.upload_validation import validate_frame_upload, validate_media_upload
from core.config import (
    EMOTION_DELIVERY_BLEND_WEIGHT,
    EMOTION_MODEL_ID,
    EMBEDDING_MODEL_ID,
    ELEVENLABS_STT_MODEL_ID,
)
from ml_pipeline.audio.analysis import DeliveryAnalysisResult, analyze_delivery
from ml_pipeline.audio.emotion import EmotionAnalysisResult, analyze_voice_emotion, blend_delivery_score, get_emotion_pipeline
from ml_pipeline.audio.extraction import AudioExtractionError, AudioExtractionTimeoutError, extract_audio_to_wav
from ml_pipeline.fusion.scorer import FusionResult, run_fusion
from ml_pipeline.text.scoring import (
    ContentScoreResult,
    analyze_content,
    get_embedding_model,
    get_sbert_model,
)
from ml_pipeline.text.transcription import get_transcription_pipeline, transcribe_audio
from ml_pipeline.video.emotion import (
    FrameDetectionResult,
    VideoEmotionResult,
    analyze_video_emotion,
    detect_frame_emotion,
    get_emotion_model,
    get_face_detector,
)

router = APIRouter()


class EmotionMetrics(BaseModel):
    """Voice emotion metrics exposed in the analysis API response."""

    dominant_emotion: str
    emotion_distribution: dict[str, float]
    stability_score: float
    nervous_rate: float
    emotion_score: int = Field(ge=0, le=100)
    chunks_analyzed: int = Field(ge=0)


class VideoEmotionMetrics(BaseModel):
    """Facial emotion metrics exposed in the analysis API response."""

    dominant_emotion: str
    emotion_distribution: dict[str, float]
    stability_score: float
    nervous_rate: float
    non_verbal_score: int = Field(ge=0, le=100)
    frames_analyzed: int = Field(ge=0)
    frames_sampled: int = Field(ge=0)


class BoundingBox(BaseModel):
    """Relative face bounding box (0–1 coordinates)."""

    x: float
    y: float
    w: float
    h: float


class FrameDetectionResponse(BaseModel):
    """Live camera frame emotion detection response."""

    emotion: str
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: BoundingBox | None = None


class ContentMetrics(BaseModel):
    """Content scoring breakdown exposed in the analysis API response."""

    semantic_score: int = Field(ge=0, le=100)
    rubric_score: int = Field(ge=0, le=100)
    completeness_score: int = Field(ge=0, le=100)
    cosine_similarity: float = Field(ge=0.0, le=1.0)
    cross_encoder_score: int | None = Field(default=None, ge=0, le=100)
    question_text: str
    behavioral_question: bool


class DeliveryMetrics(BaseModel):
    """Delivery metrics exposed in the analysis API response.

    Attributes:
        wpm: Words per minute.
        filler_count: Number of detected filler tokens.
        filler_rate: Filler rate as a percentage of total words.
        avg_pause_sec: Average pause between speech segments.
        longest_silence_sec: Longest detected silence gap.
        duration_sec: Total audio duration in seconds.
        filler_words_found: Matched filler phrases from transcript.
    """

    wpm: float
    filler_count: int
    filler_rate: float
    avg_pause_sec: float
    longest_silence_sec: float
    duration_sec: float
    filler_words_found: list[str] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    """Full multimodal analysis response.

    Attributes:
        final_score: Weighted total score 0–100.
        content_score: Text/content dimension score.
        delivery_score: Audio delivery dimension score.
        non_verbal_score: Non-verbal dimension score.
        transcription: ElevenLabs speech-to-text output.
        delivery_metrics: Raw delivery metrics.
        emotion_metrics: Voice emotion (SER) metrics.
        video_emotion_metrics: Facial emotion metrics from the video stream.
        feedback: Actionable feedback by dimension.
        file_name: Original uploaded filename.
        file_size_bytes: Uploaded file size in bytes.
    """

    final_score: int = Field(ge=0, le=100)
    content_score: int = Field(ge=0, le=100)
    delivery_score: int = Field(ge=0, le=100)
    non_verbal_score: int = Field(ge=0, le=100)
    transcription: str
    content_metrics: ContentMetrics
    delivery_metrics: DeliveryMetrics
    emotion_metrics: EmotionMetrics
    video_emotion_metrics: VideoEmotionMetrics
    feedback: dict[str, str]
    file_name: str
    file_size_bytes: int


class AnalyzeAsyncResponse(BaseModel):
    """Response returned immediately when a media file is queued for analysis."""
    status: str
    job_id: str


@dataclass
class _ProcessResult:
    """Internal pipeline result from the worker thread."""

    transcription: str
    content: ContentScoreResult
    delivery: DeliveryAnalysisResult
    emotion: EmotionAnalysisResult
    video_emotion: VideoEmotionResult
    fusion: FusionResult


@router.post("/api/detect-frame", response_model=FrameDetectionResponse)
async def detect_frame(file: UploadFile = File(...)) -> FrameDetectionResponse:
    """Detect facial emotion and bounding box on a single camera frame.

    Args:
        file: JPEG or PNG image bytes from the browser canvas.

    Returns:
        Emotion label, confidence, and optional relative bounding box.
    """

    log.debug("detect-frame request received  content_type=%s", file.content_type)

    try:
        contents = await file.read()
    except OSError as exc:
        log.error("detect-frame: failed to read upload — %s", exc)
        raise HTTPException(status_code=400, detail="Unable to read frame.") from exc

    try:
        validate_frame_upload(file.content_type, contents)
    except ValueError as exc:
        log.warning("detect-frame: validation failed — %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result: FrameDetectionResult = await to_thread.run_sync(
        detect_frame_emotion,
        contents,
    )

    log.debug(
        "detect-frame: emotion=%s  confidence=%.3f  has_bbox=%s",
        result.emotion,
        result.confidence,
        result.bbox_x is not None,
    )

    bbox = None
    if (
        result.bbox_x is not None
        and result.bbox_y is not None
        and result.bbox_w is not None
        and result.bbox_h is not None
    ):
        bbox = BoundingBox(
            x=result.bbox_x,
            y=result.bbox_y,
            w=result.bbox_w,
            h=result.bbox_h,
        )

    return FrameDetectionResponse(
        emotion=result.emotion,
        confidence=result.confidence,
        bbox=bbox,
    )


@router.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_interview(
    file: UploadFile = File(...),
    question_text: str = Form(default=""),
    question_topic: str = Form(default=""),
) -> AnalyzeResponse:
    """Analyze uploaded interview media end-to-end.

    Pipeline: ffmpeg extraction → ElevenLabs transcription → delivery + voice emotion →
    E5 content score → video facial emotion (YOLOv8-cls + OpenCV) →
    weighted fusion.

    Args:
        file: Uploaded ``.mp4``, ``.wav``, or other media supported by ffmpeg.
        question_text: The interview question the candidate answered (preferred).
        question_topic: Role/topic context for rubric enrichment and fallback matching.

    Returns:
        Structured analysis with scores, metrics, transcript, and feedback.

    Raises:
        HTTPException: On empty uploads or processing failures.
    """

    log.info(
        "analyze: upload received  filename=%r  content_type=%s  question=%r  topic=%r",
        file.filename,
        file.content_type,
        question_text[:60] if question_text else "",
        question_topic[:60] if question_topic else "",
    )

    try:
        contents = await file.read()
    except OSError as exc:
        log.error("analyze: failed to read upload — %s", exc)
        raise HTTPException(
            status_code=400,
            detail="Unable to read the uploaded file.",
        ) from exc

    try:
        upload = validate_media_upload(file.filename, file.content_type, contents)
    except ValueError as exc:
        log.warning("analyze: validation failed — %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log.info(
        "analyze: validation passed  size_bytes=%d  suffix=%s",
        upload.size_bytes,
        upload.suffix,
    )

    t_start = time.monotonic()
    try:
        with TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            upload_path = temp_path / f"interview-upload{upload.suffix}"
            audio_path = temp_path / "interview-audio.wav"
            upload_path.write_bytes(contents)

            result = await to_thread.run_sync(
                _process_interview,
                upload_path,
                audio_path,
                question_text,
                question_topic,
            )
    except AudioExtractionTimeoutError as exc:
        log.error("analyze: audio extraction timed out — %s", exc)
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except AudioExtractionError as exc:
        log.error("analyze: audio extraction error — %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        log.error("analyze: pipeline runtime error — %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Analysis pipeline failed.") from exc

    elapsed_s = time.monotonic() - t_start
    delivery = result.delivery
    emotion = result.emotion
    video_emotion = result.video_emotion
    fusion = result.fusion

    log.info(
        "analyze: pipeline complete  elapsed=%.1fs  final_score=%d  "
        "content=%d  delivery=%d  non_verbal=%d",
        elapsed_s,
        fusion.final_score,
        fusion.content_score,
        fusion.delivery_score,
        fusion.non_verbal_score,
    )

    return AnalyzeResponse(
        final_score=fusion.final_score,
        content_score=fusion.content_score,
        delivery_score=fusion.delivery_score,
        non_verbal_score=fusion.non_verbal_score,
        transcription=result.transcription,
        content_metrics=ContentMetrics(
            semantic_score=result.content.semantic_score,
            rubric_score=result.content.rubric_score,
            completeness_score=result.content.completeness_score,
            cosine_similarity=result.content.cosine_similarity,
            cross_encoder_score=result.content.cross_encoder_score,
            question_text=result.content.question_used,
            behavioral_question=result.content.behavioral_question,
        ),
        delivery_metrics=DeliveryMetrics(
            wpm=delivery.wpm,
            filler_count=delivery.filler_count,
            filler_rate=delivery.filler_rate,
            avg_pause_sec=delivery.avg_pause_sec,
            longest_silence_sec=delivery.longest_silence_sec,
            duration_sec=delivery.duration_sec,
            filler_words_found=delivery.filler_words_found,
        ),
        emotion_metrics=EmotionMetrics(
            dominant_emotion=emotion.dominant_emotion,
            emotion_distribution=emotion.emotion_distribution,
            stability_score=emotion.stability_score,
            nervous_rate=emotion.nervous_rate,
            emotion_score=emotion.emotion_score,
            chunks_analyzed=emotion.chunks_analyzed,
        ),
        video_emotion_metrics=VideoEmotionMetrics(
            dominant_emotion=video_emotion.dominant_emotion,
            emotion_distribution=video_emotion.emotion_distribution,
            stability_score=video_emotion.stability_score,
            nervous_rate=video_emotion.nervous_rate,
            non_verbal_score=video_emotion.non_verbal_score,
            frames_analyzed=video_emotion.frames_analyzed,
            frames_sampled=video_emotion.frames_sampled,
        ),
        feedback=fusion.feedback,
        file_name=file.filename or "uploaded-media",
        file_size_bytes=upload.size_bytes,
    )


def _process_interview(
    upload_path: Path,
    audio_path: Path,
    question_text: str,
    question_topic: str,
) -> _ProcessResult:
    """Run the full blocking analysis pipeline.

    Args:
        upload_path: Path to the uploaded media file.
        audio_path: Path for normalized WAV output.
        question_text: Interview question the candidate answered.
        question_topic: Role/topic context for rubric enrichment.

    Returns:
        Transcription, delivery metrics, and fusion result.
    """

    extracted = extract_audio_to_wav(upload_path, audio_path)
    transcription = transcribe_audio(extracted)
    delivery = analyze_delivery(transcription, extracted)
    emotion = analyze_voice_emotion(extracted)
    blended_delivery = (
        blend_delivery_score(
            delivery.delivery_score,
            emotion.emotion_score,
            EMOTION_DELIVERY_BLEND_WEIGHT,
        )
        if emotion.chunks_analyzed > 0
        else delivery.delivery_score
    )
    content = analyze_content(
        transcription,
        question_text=question_text,
        question_topic=question_topic,
    )
    video_emotion = analyze_video_emotion(upload_path)
    fusion = run_fusion(
        content.total,
        delivery,
        video_emotion.non_verbal_score,
        transcription,
        emotion=emotion,
        video_emotion=video_emotion,
        blended_delivery_score=blended_delivery,
        content_details=content,
    )

    return _ProcessResult(
        transcription=transcription,
        content=content,
        delivery=delivery,
        emotion=emotion,
        video_emotion=video_emotion,
        fusion=fusion,
    )


async def _process_interview_async(
    contents: bytes,
    suffix: str,
    question_text: str,
    question_topic: str,
    webhook_url: str,
    job_id: str,
    file_name: str,
    file_size_bytes: int,
) -> None:
    """Background task to run the heavy ML pipeline and trigger a webhook."""
    log.info("async_analyze: starting background task for job_id=%r", job_id)
    t_start = time.monotonic()
    
    try:
        with TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            upload_path = temp_path / f"interview-upload{suffix}"
            audio_path = temp_path / "interview-audio.wav"
            upload_path.write_bytes(contents)

            result = await to_thread.run_sync(
                _process_interview,
                upload_path,
                audio_path,
                question_text,
                question_topic,
            )
            
        elapsed_s = time.monotonic() - t_start
        delivery = result.delivery
        emotion = result.emotion
        video_emotion = result.video_emotion
        fusion = result.fusion

        response_data = AnalyzeResponse(
            final_score=fusion.final_score,
            content_score=fusion.content_score,
            delivery_score=fusion.delivery_score,
            non_verbal_score=fusion.non_verbal_score,
            transcription=result.transcription,
            content_metrics=ContentMetrics(
                semantic_score=result.content.semantic_score,
                rubric_score=result.content.rubric_score,
                completeness_score=result.content.completeness_score,
                cosine_similarity=result.content.cosine_similarity,
                cross_encoder_score=result.content.cross_encoder_score,
                question_text=result.content.question_used,
                behavioral_question=result.content.behavioral_question,
            ),
            delivery_metrics=DeliveryMetrics(
                wpm=delivery.wpm,
                filler_count=delivery.filler_count,
                filler_rate=delivery.filler_rate,
                avg_pause_sec=delivery.avg_pause_sec,
                longest_silence_sec=delivery.longest_silence_sec,
                duration_sec=delivery.duration_sec,
                filler_words_found=delivery.filler_words_found,
            ),
            emotion_metrics=EmotionMetrics(
                dominant_emotion=emotion.dominant_emotion,
                emotion_distribution=emotion.emotion_distribution,
                stability_score=emotion.stability_score,
                nervous_rate=emotion.nervous_rate,
                emotion_score=emotion.emotion_score,
                chunks_analyzed=emotion.chunks_analyzed,
            ),
            video_emotion_metrics=VideoEmotionMetrics(
                dominant_emotion=video_emotion.dominant_emotion,
                emotion_distribution=video_emotion.emotion_distribution,
                stability_score=video_emotion.stability_score,
                nervous_rate=video_emotion.nervous_rate,
                non_verbal_score=video_emotion.non_verbal_score,
                frames_analyzed=video_emotion.frames_analyzed,
                frames_sampled=video_emotion.frames_sampled,
            ),
            feedback=fusion.feedback,
            file_name=file_name,
            file_size_bytes=file_size_bytes,
        )

        log.info("async_analyze: pipeline complete job_id=%r elapsed=%.1fs. sending webhook...", job_id, elapsed_s)
        
        async with httpx.AsyncClient() as client:
            webhook_payload = {
                "job_id": job_id,
                "status": "completed",
                "result": response_data.model_dump()
            }
            res = await client.post(webhook_url, json=webhook_payload, timeout=15.0)
            res.raise_for_status()
            log.info("async_analyze: webhook sent successfully for job_id=%r", job_id)

    except Exception as exc:
        log.error("async_analyze: background task failed for job_id=%r — %s", job_id, exc, exc_info=True)
        try:
            async with httpx.AsyncClient() as client:
                webhook_payload = {
                    "job_id": job_id,
                    "status": "error",
                    "error": str(exc)
                }
                await client.post(webhook_url, json=webhook_payload, timeout=10.0)
        except Exception as inner_exc:
            log.error("async_analyze: failed to send error webhook for job_id=%r — %s", job_id, inner_exc)


@router.post("/api/analyze-async", response_model=AnalyzeAsyncResponse)
async def analyze_interview_async(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    question_text: str = Form(default=""),
    question_topic: str = Form(default=""),
    webhook_url: str = Form(...),
    job_id: str = Form(...),
) -> AnalyzeAsyncResponse:
    """Queue media for background analysis and return immediately."""
    log.info(
        "analyze_async: upload received  job_id=%r  filename=%r  webhook_url=%r",
        job_id,
        file.filename,
        webhook_url,
    )

    try:
        contents = await file.read()
    except OSError as exc:
        raise HTTPException(status_code=400, detail="Unable to read the uploaded file.") from exc

    try:
        upload = validate_media_upload(file.filename, file.content_type, contents)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    background_tasks.add_task(
        _process_interview_async,
        contents=contents,
        suffix=upload.suffix,
        question_text=question_text,
        question_topic=question_topic,
        webhook_url=webhook_url,
        job_id=job_id,
        file_name=file.filename or "uploaded-media",
        file_size_bytes=upload.size_bytes,
    )

    return AnalyzeAsyncResponse(status="queued", job_id=job_id)


# ─── Preflight model-load checks ────────────────────────────────────────────


class PreflightResult(BaseModel):
    """Result of a single model preflight check."""

    key: str
    label: str
    model_id: str
    status: str  # "ok" | "error"
    elapsed_ms: int
    message: str = ""


def _run_preflight(key: str, label: str, model_id: str, loader: object) -> PreflightResult:
    """Load one model and return timing + status.

    Logs a structured INFO line on success and an ERROR line (with traceback)
    on failure so the root cause is always visible in the server console.
    """
    log.info("preflight: [%s] starting  model_id=%r", key, model_id)
    t0 = time.monotonic()
    try:
        loader()  # type: ignore[call-arg]
        elapsed = int((time.monotonic() - t0) * 1000)
        log.info("preflight: [%s] ✓ loaded in %d ms", key, elapsed)
        return PreflightResult(key=key, label=label, model_id=model_id, status="ok", elapsed_ms=elapsed)
    except Exception as exc:
        elapsed = int((time.monotonic() - t0) * 1000)
        log.error(
            "preflight: [%s] ✗ FAILED after %d ms — %s: %s",
            key,
            elapsed,
            type(exc).__name__,
            exc,
            exc_info=True,
        )
        return PreflightResult(
            key=key,
            label=label,
            model_id=model_id,
            status="error",
            elapsed_ms=elapsed,
            message=f"{type(exc).__name__}: {exc}",
        )


_PREFLIGHT_MODELS = [
    ("elevenlabs", "ElevenLabs Scribe", ELEVENLABS_STT_MODEL_ID, get_transcription_pipeline),
    ("wav2vec2",  "Wav2Vec2 Voice SER", EMOTION_MODEL_ID,  get_emotion_pipeline),
    ("sbert",     "E5 Content Embed",   EMBEDDING_MODEL_ID, get_embedding_model),
    ("yolo",      "YOLOv8 Facial",      "best.pt",         get_emotion_model),
    ("mediapipe", "Face Detector",      "yolov8n-face.pt", get_face_detector),
]


@router.get("/api/preflight/{model_key}", response_model=PreflightResult)
async def preflight_check(model_key: str) -> PreflightResult:
    """Load a single model and return its status.

    Called sequentially by the frontend checklist UI before recording starts.

    Args:
        model_key: One of ``elevenlabs``, ``wav2vec2``, ``sbert``, ``yolo``,
            ``mediapipe``.

    Returns:
        :class:`PreflightResult` with status and load time.

    Raises:
        HTTPException: 404 if ``model_key`` is unknown.
    """
    log.info("preflight: request received  model_key=%r", model_key)
    entry = next((m for m in _PREFLIGHT_MODELS if m[0] == model_key), None)
    if entry is None:
        log.warning("preflight: unknown model_key=%r", model_key)
        raise HTTPException(status_code=404, detail=f"Unknown model key: {model_key}")

    key, label, model_id, loader = entry
    result = await to_thread.run_sync(lambda: _run_preflight(key, label, model_id, loader))
    log.info(
        "preflight: response sent  key=%s  status=%s  elapsed_ms=%d",
        result.key,
        result.status,
        result.elapsed_ms,
    )
    return result
