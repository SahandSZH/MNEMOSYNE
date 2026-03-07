from __future__ import annotations

import mimetypes
import os
from pathlib import Path
from typing import Any

try:
    import requests
except Exception:  # pragma: no cover - optional dependency for runtime
    requests = None  # type: ignore[assignment]

try:
    from elevenlabs.client import ElevenLabs
except Exception:  # pragma: no cover - optional dependency for runtime
    ElevenLabs = None  # type: ignore[assignment]


ELEVENLABS_STT_ENDPOINTS = (
    "https://api.elevenlabs.io/v1/speech-to-text",
    "https://api.elevenlabs.io/v1/speech-to-text/convert",
)


class SpeechTranscriptionError(RuntimeError):
    """Raised when audio transcription fails."""


def _extract_transcript_text(payload: Any) -> str:
    if isinstance(payload, str):
        return payload.strip()

    if isinstance(payload, dict):
        text = payload.get("text") or payload.get("transcript")
        return str(text).strip() if text else ""

    text = getattr(payload, "text", None)
    if isinstance(text, str):
        return text.strip()

    model_dump = getattr(payload, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump()
        if isinstance(dumped, dict):
            text = dumped.get("text") or dumped.get("transcript")
            return str(text).strip() if text else ""

    return ""


def _transcribe_with_sdk(
    audio_path: Path,
    api_key: str,
    model_id: str,
    language_code: str | None,
    diarize: bool,
    tag_audio_events: bool,
) -> str:
    if ElevenLabs is None:
        raise SpeechTranscriptionError(
            "ElevenLabs SDK is not installed; falling back to HTTP API."
        )

    client = ElevenLabs(api_key=api_key)
    with audio_path.open("rb") as audio_file:
        response = client.speech_to_text.convert(
            file=audio_file,
            model_id=model_id,
            language_code=language_code,
            diarize=diarize,
            tag_audio_events=tag_audio_events,
        )

    transcript = _extract_transcript_text(response)
    if not transcript:
        raise SpeechTranscriptionError("ElevenLabs SDK returned an empty transcript.")
    return transcript


def _transcribe_with_http(
    audio_path: Path,
    api_key: str,
    model_id: str,
    language_code: str | None,
    diarize: bool,
    tag_audio_events: bool,
    timeout_seconds: int,
) -> str:
    if requests is None:
        raise SpeechTranscriptionError(
            "requests package is not installed. Install it with: pip install requests"
        )

    mime_type = mimetypes.guess_type(audio_path.name)[0] or "application/octet-stream"
    form_data: dict[str, str] = {
        "model_id": model_id,
        "diarize": str(diarize).lower(),
        "tag_audio_events": str(tag_audio_events).lower(),
    }
    if language_code:
        form_data["language_code"] = language_code

    for endpoint in ELEVENLABS_STT_ENDPOINTS:
        with audio_path.open("rb") as audio_file:
            response = requests.post(
                endpoint,
                headers={"xi-api-key": api_key},
                data=form_data,
                files={"file": (audio_path.name, audio_file, mime_type)},
                timeout=timeout_seconds,
            )

        if response.status_code in (404, 405):
            continue

        if response.status_code >= 400:
            raise SpeechTranscriptionError(
                f"ElevenLabs HTTP error {response.status_code}: {response.text[:500]}"
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise SpeechTranscriptionError(
                "ElevenLabs response was not valid JSON."
            ) from exc

        transcript = _extract_transcript_text(payload)
        if transcript:
            return transcript

        raise SpeechTranscriptionError("ElevenLabs returned an empty transcript.")

    raise SpeechTranscriptionError(
        "None of the ElevenLabs speech-to-text endpoints were accepted."
    )


def transcribe_audio(
    audio_path: str | Path,
    *,
    api_key: str | None = None,
    model_id: str = "scribe_v1",
    language_code: str | None = "eng",
    diarize: bool = False,
    tag_audio_events: bool = False,
    timeout_seconds: int = 180,
) -> str:
    """
    Transcribe a patient audio sample using ElevenLabs Speech-to-Text API.

    FastAPI usage:
    transcript = transcribe_audio("/tmp/patient.wav")
    """
    resolved_api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
    if not resolved_api_key:
        raise ValueError(
            "Missing ElevenLabs API key. Set ELEVENLABS_API_KEY or pass api_key."
        )

    resolved_path = Path(audio_path).expanduser()
    if not resolved_path.is_file():
        raise FileNotFoundError(f"Audio file not found: {resolved_path}")

    errors: list[str] = []

    try:
        return _transcribe_with_sdk(
            audio_path=resolved_path,
            api_key=resolved_api_key,
            model_id=model_id,
            language_code=language_code,
            diarize=diarize,
            tag_audio_events=tag_audio_events,
        )
    except Exception as exc:
        errors.append(f"SDK attempt failed: {exc}")

    try:
        return _transcribe_with_http(
            audio_path=resolved_path,
            api_key=resolved_api_key,
            model_id=model_id,
            language_code=language_code,
            diarize=diarize,
            tag_audio_events=tag_audio_events,
            timeout_seconds=timeout_seconds,
        )
    except Exception as exc:
        errors.append(f"HTTP attempt failed: {exc}")

    raise SpeechTranscriptionError(" | ".join(errors))
