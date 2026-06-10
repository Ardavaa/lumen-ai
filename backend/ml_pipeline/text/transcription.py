"""
Transkripsi Suara ke Teks (Speech-to-Text)
Menggunakan ElevenLabs Scribe API untuk mengubah rekaman suara menjadi teks.
"""

import logging
from functools import cache
from pathlib import Path

from elevenlabs.client import ElevenLabs
from core.config import ELEVENLABS_API_KEY, ELEVENLABS_STT_MODEL_ID

log = logging.getLogger(__name__)

@cache
def get_transcription_pipeline() -> ElevenLabs:
    """Menginisialisasi dan menyimpan cache instance client ElevenLabs."""
    log.info("ElevenLabs: inisialisasi client API (STT)")
    if not ELEVENLABS_API_KEY:
        log.warning("ElevenLabs: ELEVENLABS_API_KEY tidak ditemukan di environment!")
    client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    return client

def transcribe_audio(audio_path: Path) -> str:
    """Mengubah berkas suara WAV menjadi teks transkripsi menggunakan ElevenLabs."""
    log.info("ElevenLabs: memulai transkripsi berkas=%s", audio_path.name)
    client = get_transcription_pipeline()

    try:
        with open(audio_path, "rb") as f:
            transcription = client.speech_to_text.convert(
                file=f,
                model_id=ELEVENLABS_STT_MODEL_ID
            )
        
        # ElevenLabs client SDK returns a SpeechToTextChunk or similar object, or direct text in dict
        # The transcription object has a text attribute.
        if hasattr(transcription, "text"):
            text = transcription.text
        else:
            text = str(transcription)

        stripped = text.strip()
        log.info("ElevenLabs: selesai transkripsi (%d karakter)", len(stripped))
        return stripped
    except Exception as exc:
        log.error("ElevenLabs: gagal transkripsi — %s", exc)
        raise
