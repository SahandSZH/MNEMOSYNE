from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import require_roles
from app.database import get_db
from app.models.ai_report import AIReport
from app.models.assessment import Assessment
from app.models.assessment_session import AssessmentSession
from app.models.clock_drawing_submission import ClockDrawingSubmission
from app.schemas.assessment import ClockDrawingUploadResponse
from app.services.clock_drawing_service import ClockDrawingService
from app.services.gemini_service import GeminiService


MAX_CLOCK_DRAWING_BYTES = 5 * 1024 * 1024

router = APIRouter(tags=["clock-drawing"])
clock_drawing_service = ClockDrawingService()
gemini_service = GeminiService()


def _load_assessment_by_id(db: Session, assessment_id: int) -> Assessment | None:
    return db.scalar(
        select(Assessment)
        .options(
            selectinload(Assessment.session),
            selectinload(Assessment.clock_drawing_submission),
            selectinload(Assessment.speech_metrics),
            selectinload(Assessment.facial_metrics),
            selectinload(Assessment.ai_report),
        )
        .where(Assessment.id == assessment_id)
    )


def _load_assessment_by_session(db: Session, session_id: str) -> Assessment | None:
    session = db.scalar(
        select(AssessmentSession)
        .options(
            selectinload(AssessmentSession.assessment).selectinload(Assessment.session),
            selectinload(AssessmentSession.assessment).selectinload(
                Assessment.clock_drawing_submission
            ),
            selectinload(AssessmentSession.assessment).selectinload(Assessment.speech_metrics),
            selectinload(AssessmentSession.assessment).selectinload(Assessment.facial_metrics),
            selectinload(AssessmentSession.assessment).selectinload(Assessment.ai_report),
        )
        .where(AssessmentSession.session_id == session_id)
    )
    if session is None:
        return None
    return session.assessment


@router.post("/clock-drawing", response_model=ClockDrawingUploadResponse)
async def upload_clock_drawing(
    assessment_id: int | None = Form(default=None),
    session_id: str | None = Form(default=None),
    image_file: UploadFile = File(...),
    run_analysis: bool = Form(default=True),
    db: Session = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_roles("doctor", "patient")),
) -> ClockDrawingUploadResponse:
    _ = current_user

    if assessment_id is None and session_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one of assessment_id or session_id.",
        )

    assessment = None
    if session_id is not None:
        assessment = _load_assessment_by_session(db, session_id)
    if assessment is None and assessment_id is not None:
        assessment = _load_assessment_by_id(db, assessment_id)
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found for provided identifiers.",
        )
    if assessment_id is not None and assessment.id != assessment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="assessment_id does not match provided session_id.",
        )

    if not image_file.content_type or not image_file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="clock drawing upload must be an image file.",
        )

    image_bytes = await image_file.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded clock drawing image is empty.",
        )
    if len(image_bytes) > MAX_CLOCK_DRAWING_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Clock drawing image exceeds {MAX_CLOCK_DRAWING_BYTES} bytes limit.",
        )

    analysis_result: dict[str, int | str] = {}
    if run_analysis:
        analysis_result = clock_drawing_service.analyze(
            image_bytes=image_bytes,
            filename=image_file.filename or "clock-drawing",
        )

    drawing = assessment.clock_drawing_submission
    if drawing is None:
        drawing = ClockDrawingSubmission(
            assessment_id=assessment.id,
            filename=image_file.filename or "clock-drawing",
            content_type=image_file.content_type,
            image_bytes=image_bytes,
            analyzed_score=int(analysis_result["drawing_score"]) if analysis_result else None,
            analysis_notes=str(analysis_result["analysis_notes"]) if analysis_result else None,
        )
        db.add(drawing)
    else:
        drawing.filename = image_file.filename or drawing.filename
        drawing.content_type = image_file.content_type
        drawing.image_bytes = image_bytes
        drawing.analyzed_score = (
            int(analysis_result["drawing_score"]) if analysis_result else drawing.analyzed_score
        )
        drawing.analysis_notes = (
            str(analysis_result["analysis_notes"]) if analysis_result else drawing.analysis_notes
        )

    if drawing.analyzed_score is not None:
        assessment.drawing_score = drawing.analyzed_score

    report_data = gemini_service.generate_assessment_report(
        recall_score=assessment.recall_score,
        drawing_score=assessment.drawing_score,
        fluency_score=assessment.fluency_score,
        speech_metrics={
            "word_count": assessment.speech_metrics.word_count,
            "speech_rate": assessment.speech_metrics.speech_rate,
            "vocabulary_diversity": assessment.speech_metrics.vocabulary_diversity,
        }
        if assessment.speech_metrics is not None
        else None,
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
    db.refresh(drawing)

    return ClockDrawingUploadResponse(
        assessment_id=assessment.id,
        session_id=assessment.session_id,
        filename=drawing.filename,
        content_type=drawing.content_type,
        analyzed_score=drawing.analyzed_score,
        analysis_notes=drawing.analysis_notes,
    )
