from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import require_roles
from app.database import get_db
from app.models.assessment import Assessment
from app.models.assessment_session import AssessmentSession
from app.schemas.assessment import (
    FacialBiometricCreate,
    FacialBiometricResponse,
    FacialMetricsPayload,
)
from app.services.facial_analysis import FacialAnalysisService


router = APIRouter(prefix="/biometrics", tags=["biometrics"])
facial_analysis_service = FacialAnalysisService()


@router.post("/facial", response_model=FacialBiometricResponse)
def upload_facial_metrics(
    payload: FacialBiometricCreate,
    db: Session = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_roles("doctor", "patient")),
) -> FacialBiometricResponse:
    _ = current_user

    session = db.scalar(
        select(AssessmentSession)
        .options(
            selectinload(AssessmentSession.assessment).selectinload(Assessment.session),
            selectinload(AssessmentSession.assessment).selectinload(Assessment.speech_metrics),
            selectinload(AssessmentSession.assessment).selectinload(Assessment.facial_metrics),
            selectinload(AssessmentSession.assessment).selectinload(Assessment.ai_report),
        )
        .where(AssessmentSession.session_id == payload.session_id)
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found for provided session_id.",
        )
    assessment = session.assessment
    if assessment.patient_id != payload.patient_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="patient_id does not match the assessment in session_id.",
        )

    try:
        metric, presage_result = facial_analysis_service.process_facial_metrics(
            db=db,
            assessment=assessment,
            facial_metrics=payload.facial_metrics.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return FacialBiometricResponse(
        assessment_id=assessment.id,
        patient_id=assessment.patient_id,
        session_id=session.session_id,
        facial_metrics=FacialMetricsPayload(
            face_presence_score=metric.face_presence_score,
            blink_rate=metric.blink_rate,
            eye_focus_score=metric.eye_focus_score,
            expression_variability=metric.expression_variability,
        ),
        presage_behavioral_risk=presage_result.get("behavioral_risk"),
        presage_risk_score=presage_result.get("risk_score"),
    )
