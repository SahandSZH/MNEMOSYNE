from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_roles
from app.database import get_db
from app.models.assessment import Assessment
from app.models.speech_metric import SpeechMetric
from app.schemas.assessment import SpeechUploadResponse
from app.services.elevenlabs_service import ElevenLabsService


router = APIRouter(tags=["speech"])
elevenlabs_service = ElevenLabsService()


@router.post("/speech", response_model=SpeechUploadResponse)
async def upload_speech_file(
    assessment_id: int = Form(...),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict[str, Any] = Depends(
        require_roles("doctor", "patient", "caregiver")
    ),
) -> SpeechUploadResponse:
    _ = current_user

    assessment = db.scalar(select(Assessment).where(Assessment.id == assessment_id))
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )

    audio_bytes = await audio_file.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty.",
        )

    transcription = elevenlabs_service.transcribe(
        audio_bytes=audio_bytes,
        filename=audio_file.filename or "audio",
    )

    metric = db.scalar(
        select(SpeechMetric).where(SpeechMetric.assessment_id == assessment_id)
    )
    if metric is None:
        metric = SpeechMetric(
            assessment_id=assessment_id,
            word_count=int(transcription["word_count"]),
            speech_rate=float(transcription["speech_rate"]),
        )
        db.add(metric)
    else:
        metric.word_count = int(transcription["word_count"])
        metric.speech_rate = float(transcription["speech_rate"])

    db.commit()

    return SpeechUploadResponse(
        assessment_id=assessment_id,
        transcript=str(transcription["transcript"]),
        word_count=int(transcription["word_count"]),
        speech_rate=float(transcription["speech_rate"]),
    )
