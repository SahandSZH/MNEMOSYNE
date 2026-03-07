from app.config import settings


class ElevenLabsService:
    def __init__(self) -> None:
        self.api_key = settings.elevenlabs_api_key

    def transcribe(self, audio_bytes: bytes, filename: str) -> dict[str, str | int | float]:
        # Placeholder implementation.
        transcript = (
            f"Placeholder transcript for {filename}. "
            "Replace with ElevenLabs Speech-to-Text API integration."
        )
        word_count = len(transcript.split())

        # Rough estimate based on file size (assumes 16kHz mono PCM-like payload).
        duration_seconds = max(len(audio_bytes) / 32000.0, 1.0)
        speech_rate = round((word_count / duration_seconds) * 60.0, 2)

        return {
            "transcript": transcript,
            "word_count": word_count,
            "speech_rate": speech_rate,
        }
