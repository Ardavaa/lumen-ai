"""
Penggabungan Skor dan Feedback (Score Fusion & Feedback)
Menggabungkan skor dari berbagai penilaian (konten, suara, visual) dan memberikan saran otomatis.
"""

from __future__ import annotations
from dataclasses import dataclass

from core.config import (
    DURATION_FLOOR_SEC,
    DURATION_HARD_CAP_SCORE,
    MIN_DURATION_FULL_SCORE_SEC,
    WEIGHT_CONTENT,
    WEIGHT_DELIVERY,
    WEIGHT_NON_VERBAL,
)
from ml_pipeline.audio.analysis import DeliveryAnalysisResult
from ml_pipeline.audio.emotion import EmotionAnalysisResult
from ml_pipeline.text.scoring import ContentScoreResult
from ml_pipeline.video.emotion import VideoEmotionResult

@dataclass(frozen=True)
class FusionResult:
    final_score: int
    content_score: int
    delivery_score: int
    non_verbal_score: int
    feedback: dict[str, str]

def _duration_penalty_factor(duration_sec: float) -> tuple[float, bool]:
    """Menghitung pinalti nilai jika durasi rekaman terlalu singkat."""
    if duration_sec < DURATION_FLOOR_SEC:
        return 0.0, True  # Di bawah batas minimum mutlak (sinyal hard cap)
    
    if duration_sec < MIN_DURATION_FULL_SCORE_SEC:
        # Penurunan linear dari durasi penuh ke durasi lantai
        factor = (duration_sec - DURATION_FLOOR_SEC) / (
            MIN_DURATION_FULL_SCORE_SEC - DURATION_FLOOR_SEC
        )
        return max(0.0, min(1.0, factor)), False
    
    return 1.0, False

def fuse(
    content_score: int,
    delivery_score: int,
    non_verbal_score: int,
    *,
    include_non_verbal: bool = True,
) -> int:
    """Menggabungkan skor konten, suara, dan visual menggunakan pembobotan."""
    if not include_non_verbal:
        # Jika video tidak ada wajah, gabungkan konten (40%) dan penyampaian suara (30%) saja
        available_weight = WEIGHT_CONTENT + WEIGHT_DELIVERY
        raw = (
            WEIGHT_CONTENT * content_score
            + WEIGHT_DELIVERY * delivery_score
        ) / available_weight
        return int(max(0, min(100, round(raw))))

    # Bobot penuh: Konten 40%, Suara 30%, Visual 30%
    raw = (
        WEIGHT_CONTENT * content_score
        + WEIGHT_DELIVERY * delivery_score
        + WEIGHT_NON_VERBAL * non_verbal_score
    )
    return int(max(0, min(100, round(raw))))

def build_feedback(
    content_score: int,
    delivery: DeliveryAnalysisResult,
    non_verbal_score: int,
    transcription_preview: str,
    emotion: EmotionAnalysisResult | None = None,
    video_emotion: VideoEmotionResult | None = None,
    content_details: ContentScoreResult | None = None,
    duration_sec: float = 0.0,
    language: str = "en",
) -> dict[str, str]:
    """Membuat saran/masukan (feedback) otomatis berdasarkan performa jawaban kandidat."""
    is_id = language == "id"
    # 1. Cek durasi terlalu singkat
    if duration_sec < DURATION_FLOOR_SEC:
        short_warning = (
            f"⚠️ Rekaman terlalu singkat ({duration_sec:.0f}dtk). Skor tidak dapat diandalkan — mohon rekam jawaban penuh setidaknya 30 detik."
            if is_id else
            f"⚠️ Recording is too short ({duration_sec:.0f}s). Scores are unreliable — please record a full answer of at least 30 seconds."
        )
        return {"content": short_warning, "delivery": short_warning, "non_verbal": short_warning}

    duration_note = ""
    if duration_sec < MIN_DURATION_FULL_SCORE_SEC:
        duration_note = (
            f" ⚠️ Jawaban hanya {duration_sec:.0f}dtk — usahakan setidaknya {int(MIN_DURATION_FULL_SCORE_SEC)}dtk untuk skor yang dapat diandalkan."
            if is_id else
            f" ⚠️ Answer was only {duration_sec:.0f}s — aim for at least {int(MIN_DURATION_FULL_SCORE_SEC)}s for a reliable score."
        )

    # 2. Feedback Konten (Pesan jawaban)
    preview = transcription_preview[:120] + ("…" if len(transcription_preview) > 120 else "")
    if content_details is not None:
        if content_details.semantic_score < 55:
            relevance_hint = "Cobalah untuk menjawab pertanyaan dengan lebih spesifik dan langsung." if is_id else "Try to answer the specific question more directly."
        elif content_details.rubric_score < 55:
            relevance_hint = "Sertakan lebih banyak poin kunci dari pertanyaan (contoh, langkah, hasil)." if is_id else "Cover more key points from the question (examples, steps, outcomes)."
        elif content_details.completeness_score < 55:
            if content_details.behavioral_question:
                relevance_hint = "Gunakan metode STAR (Situasi, Tugas, Aksi, Hasil) dengan detail konkret." if is_id else "Expand using STAR: Situation, Task, Action, and Result with concrete detail."
            else:
                relevance_hint = "Berikan penjelasan yang lebih lengkap dengan contoh dan struktur yang jelas." if is_id else "Give a fuller explanation with examples and clearer structure."
        else:
            relevance_hint = "Relevansi dan kedalaman jawaban yang bagus untuk pertanyaan ini." if is_id else "Good relevance and depth for this question."

        content_msg = (
            f"{relevance_hint} "
            f"({is_id and 'relevansi' or 'relevance'} {content_details.semantic_score}/100, "
            f"{is_id and 'rubrik' or 'rubric'} {content_details.rubric_score}/100, "
            f"{is_id and 'kedalaman' or 'depth'} {content_details.completeness_score}/100). "
            f'{is_id and "Pratinjau" or "Preview"}: "{preview}"'
        )
    elif content_score >= 80:
        content_msg = f"{is_id and 'Sangat selaras dengan pertanyaan wawancara.' or 'Strong alignment with the interview question.'} {is_id and 'Pratinjau' or 'Preview'}: \"{preview}\""
    elif content_score >= 60:
        content_msg = is_id and "Jawaban agak sesuai topik — tambahkan contoh konkret yang menjawab pertanyaan wawancara secara langsung." or "Answer is somewhat on-topic — add more concrete examples that directly address the interview question."
    else:
        content_msg = is_id and "Konten tampak di luar topik atau terlalu singkat. Susun ulang jawaban untuk menjawab pertanyaan wawancara secara langsung." or "Content appears off-topic or too brief. Restructure answers to directly address the interview question."

    # 3. Feedback Penyampaian Suara (Delivery)
    if delivery.filler_rate > 4.0:
        if is_id:
            delivery_msg = f"Tingkat kata pengisi adalah {delivery.filler_rate:.1f}% ({delivery.filler_count} terdeteksi). Ganti kata pengisi dengan jeda singkat."
        else:
            delivery_msg = f"Filler word rate is {delivery.filler_rate:.1f}% ({delivery.filler_count} detected). Replace fillers with brief pauses."
    elif delivery.wpm > 170:
        delivery_msg = is_id and f"Kecepatan bicara terlalu cepat ({delivery.wpm} WPM) — pelankan sedikit agar lebih jelas." or f"Pacing is fast at {delivery.wpm} WPM — slow down slightly for clarity."
    elif 0 < delivery.wpm < 100:
        delivery_msg = is_id and f"Kecepatan bicara terlalu lambat ({delivery.wpm} WPM) — targetkan 130–150 WPM." or f"Pacing is slow at {delivery.wpm} WPM — aim closer to 130–150 WPM."
    else:
        if is_id:
            delivery_msg = f"Penyampaian suara yang baik di kecepatan {delivery.wpm} WPM dengan {delivery.filler_rate:.1f}% kata pengisi. Rata-rata jeda {delivery.avg_pause_sec}dtk."
        else:
            delivery_msg = f"Solid delivery at {delivery.wpm} WPM with {delivery.filler_rate:.1f}% fillers. Avg pause {delivery.avg_pause_sec}s."

    if emotion is not None and emotion.chunks_analyzed > 0:
        stability_pct = int(emotion.stability_score * 100)
        if emotion.nervous_rate >= 0.4:
            if is_id:
                delivery_msg += f" Nada suara terdengar tegang ({emotion.dominant_emotion}, {int(emotion.nervous_rate * 100)}% segmen tegang)."
            else:
                delivery_msg += f" Voice tone sounds tense ({emotion.dominant_emotion}, {int(emotion.nervous_rate * 100)}% nervous segments)."
        elif emotion.emotion_score >= 80:
            if is_id:
                delivery_msg += f" Nada suara stabil ({emotion.dominant_emotion}, stabilitas {stability_pct}%)."
            else:
                delivery_msg += f" Voice tone is steady ({emotion.dominant_emotion}, {stability_pct}% stability)."
        else:
            if is_id:
                delivery_msg += f" Skor emosi suara {emotion.emotion_score}/100 ({emotion.dominant_emotion})."
            else:
                delivery_msg += f" Voice emotion score {emotion.emotion_score}/100 ({emotion.dominant_emotion})."

    # 4. Feedback Visual/Non-Verbal
    if video_emotion is not None and video_emotion.frames_analyzed > 0:
        stability_pct = int(video_emotion.stability_score * 100)
        if video_emotion.nervous_rate >= 0.4:
            if is_id:
                non_verbal_msg = f"Ekspresi wajah terlihat tegang ({video_emotion.dominant_emotion}, {int(video_emotion.nervous_rate * 100)}% frame tegang). Usahakan ekspresi yang lebih stabil dan netral."
            else:
                non_verbal_msg = f"Facial expression looks tense ({video_emotion.dominant_emotion}, {int(video_emotion.nervous_rate * 100)}% nervous frames). Aim for a steadier, more neutral expression."
        elif non_verbal_score >= 80:
            if is_id:
                non_verbal_msg = f"Ekspresi wajah percaya diri ({video_emotion.dominant_emotion}, stabilitas {stability_pct}%)."
            else:
                non_verbal_msg = f"Confident facial expression ({video_emotion.dominant_emotion}, {stability_pct}% stability)."
        else:
            if is_id:
                non_verbal_msg = f"Skor emosi wajah {non_verbal_score}/100 ({video_emotion.dominant_emotion}, stabilitas {stability_pct}%)."
            else:
                non_verbal_msg = f"Facial emotion score {non_verbal_score}/100 ({video_emotion.dominant_emotion}, {stability_pct}% stability)."
    else:
        if is_id:
            non_verbal_msg = "Wajah tidak terdeteksi secara konsisten — pastikan wajah Anda terlihat dan cukup cahaya selama perekaman."
        else:
            non_verbal_msg = "No face detected consistently in the video — make sure your face is visible and well-lit throughout the recording."

    # Menambahkan catatan durasi ke seluruh aspek feedback jika durasinya kurang
    if duration_note:
        content_msg += duration_note
        delivery_msg += duration_note
        non_verbal_msg += duration_note

    return {
        "content": content_msg,
        "delivery": delivery_msg,
        "non_verbal": non_verbal_msg,
    }

def run_fusion(
    content_score: int,
    delivery: DeliveryAnalysisResult,
    non_verbal_score: int,
    transcription: str,
    emotion: EmotionAnalysisResult | None = None,
    video_emotion: VideoEmotionResult | None = None,
    blended_delivery_score: int | None = None,
    content_details: ContentScoreResult | None = None,
    language: str = "en",
) -> FusionResult:
    """Mengintegrasikan seluruh skor dan menyusun feedback final."""
    delivery_score = (
        blended_delivery_score
        if blended_delivery_score is not None
        else delivery.delivery_score
    )
    
    # Cek apakah ada frame wajah yang dianalisis
    include_non_verbal = video_emotion is None or video_emotion.frames_analyzed > 0
    final = fuse(
        content_score,
        delivery_score,
        non_verbal_score,
        include_non_verbal=include_non_verbal,
    )

    # Penyesuaian nilai berdasarkan durasi (misal jika terlalu singkat)
    penalty_factor, hard_capped = _duration_penalty_factor(delivery.duration_sec)
    if hard_capped:
        final = min(final, DURATION_HARD_CAP_SCORE)
        content_score = min(content_score, DURATION_HARD_CAP_SCORE)
        delivery_score = min(delivery_score, DURATION_HARD_CAP_SCORE)
        non_verbal_score = min(non_verbal_score, DURATION_HARD_CAP_SCORE)
    elif penalty_factor < 1.0:
        final = int(round(final * penalty_factor))
        content_score = int(round(content_score * penalty_factor))
        delivery_score = int(round(delivery_score * penalty_factor))
        non_verbal_score = int(round(non_verbal_score * penalty_factor))

    # 4. Generate Feedback
    feedback = build_feedback(
        content_score,
        delivery,
        non_verbal_score,
        transcription_preview=transcription,
        emotion=emotion,
        video_emotion=video_emotion,
        content_details=content_details,
        duration_sec=delivery.duration_sec,
        language=language,
    )

    return FusionResult(
        final_score=final,
        content_score=content_score,
        delivery_score=delivery_score,
        non_verbal_score=non_verbal_score,
        feedback=feedback,
    )
