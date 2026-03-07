from datetime import date as dt_date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import extract_roles, require_roles
from app.database import get_db
from app.models.ai_report import AIReport
from app.models.assessment import Assessment
from app.models.assessment_session import AssessmentSession
from app.models.patient import Patient
from app.schemas.assessment import AssessmentCreate, AssessmentRead
from app.services.gemini_service import GeminiService


router = APIRouter(tags=["assessments"])
gemini_service = GeminiService()


@router.post(
    "/assessment",
    response_model=AssessmentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_assessment(
    payload: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: dict[str, Any] = Depends(
        require_roles("doctor", "patient")
    ),
) -> Assessment:
    patient = db.scalar(select(Patient).where(Patient.id == payload.patient_id))
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        )

    user_roles = set(extract_roles(current_user))
    if "doctor" in user_roles and patient.doctor_id != current_user.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor can only submit assessments for assigned patients.",
        )

    assessment = Assessment(
        patient_id=payload.patient_id,
        date=payload.date or dt_date.today(),
        recall_score=payload.recall_score,
        drawing_score=payload.drawing_score,
        fluency_score=payload.fluency_score,
    )
    db.add(assessment)
    db.flush()

    report_data = gemini_service.generate_assessment_report(
        recall_score=payload.recall_score,
        drawing_score=payload.drawing_score,
        fluency_score=payload.fluency_score,
    )

    db.add(
        AIReport(
            assessment_id=assessment.id,
            summary=report_data["summary"],
            risk_level=report_data["risk_level"],
        )
    )
    db.add(AssessmentSession(assessment_id=assessment.id))
    db.commit()

    stored_assessment = db.scalar(
        select(Assessment)
        .options(
            selectinload(Assessment.session),
            selectinload(Assessment.clock_drawing_submission),
            selectinload(Assessment.speech_metrics),
            selectinload(Assessment.facial_metrics),
            selectinload(Assessment.ai_report),
        )
        .where(Assessment.id == assessment.id)
    )
    if stored_assessment is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Assessment persistence failed.",
        )

    return stored_assessment
