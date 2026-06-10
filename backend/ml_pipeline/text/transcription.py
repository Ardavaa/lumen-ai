"""
Transkripsi Suara ke Teks (Speech-to-Text)
Menggunakan Groq Whisper API untuk mengubah rekaman suara menjadi teks.
"""

import logging
from functools import cache
from pathlib import Path

from groq import Groq
from core.config import GROQ_API_KEY, GROQ_STT_MODEL_ID

log = logging.getLogger(__name__)

@cache
def get_transcription_pipeline() -> Groq:
    """Menginisialisasi dan menyimpan cache instance client Groq."""
    log.info("Groq: inisialisasi client API (STT)")
    if not GROQ_API_KEY:
        log.warning("Groq: GROQ_API_KEY tidak ditemukan di environment!")
    client = Groq(api_key=GROQ_API_KEY)
    return client

def transcribe_audio(audio_path: Path) -> str:
    """Mengubah berkas suara WAV menjadi teks transkripsi menggunakan Groq Whisper."""
    log.info("Groq: memulai transkripsi berkas=%s", audio_path.name)
    client = get_transcription_pipeline()

    try:
        with open(audio_path, "rb") as f:
            transcription = client.audio.transcriptions.create(
                file=(audio_path.name, f.read()),
                model=GROQ_STT_MODEL_ID,
                response_format="text"
            )
        
        stripped = str(transcription).strip()
        log.info("Groq: selesai transkripsi (%d karakter)", len(stripped))
        return stripped
    except Exception as exc:
        log.error("Groq: gagal transkripsi — %s", exc)
        raise
