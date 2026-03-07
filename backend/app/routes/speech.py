from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import require_roles
from app.database import get_db
from app.models.ai_report import AIReport
from app.models.assessment import Assessment
from app.models.speech_metric import SpeechMetric
from app.schemas.assessment import SpeechUploadResponse
from app.services.elevenlabs_service import ElevenLabsService
from app.services.gemini_service import GeminiService


router = APIRouter(tags=["speech"])
elevenlabs_service = ElevenLabsService()
gemini_service = GeminiService()


@router.post("/speech", response_model=SpeechUploadResponse)
async def upload_speech_file(
    assessment_id: int = Form(...),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict[str, Any] = Depends(
        require_roles("doctor", "patient")
    ),
) -> SpeechUploadResponse:
    _ = current_user

    assessment = db.scalar(
        select(Assessment)
        .options(
            selectinload(Assessment.speech_metrics),
            selectinload(Assessment.facial_metrics),
            selectinload(Assessment.ai_report),
        )
        .where(Assessment.id == assessment_id)
    )
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

    report_data = gemini_service.generate_assessment_report(
        recall_score=assessment.recall_score,
        drawing_score=assessment.drawing_score,
        fluency_score=assessment.fluency_score,
        speech_metrics={
            "word_count": metric.word_count,
            "speech_rate": metric.speech_rate,
        },
        facial_metrics={
            "face_presence_score": assessment.facial_metrics.face_presence_score,
            "blink_rate": assessment.facial_metrics.blink_rate,
            "eye_focus_score": assessment.facial_metrics.eye_focus_score,
            "expression_variability": assessment.facial_metrics.expression_variability,
        }
        if assessment.facial_metrics is not None
        else None,
    )

    if assessment.ai_report is None:
        db.add(
            AIReport(
                assessment_id=assessment.id,
                summary=report_data["summary"],
                risk_level=report_data["risk_level"],
            )
        )
    else:
        assessment.ai_report.summary = report_data["summary"]
        assessment.ai_report.risk_level = report_data["risk_level"]

    db.commit()

    return SpeechUploadResponse(
        assessment_id=assessment_id,
        transcript=str(transcription["transcript"]),
        word_count=int(transcription["word_count"]),
        speech_rate=float(transcription["speech_rate"]),
    )
