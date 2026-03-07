from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import require_roles
from app.database import get_db
from app.models.assessment import Assessment
from app.models.patient import Patient
from app.schemas.doctor import DoctorDashboardResponse, TrendSummary
from app.schemas.patient import PatientRead


router = APIRouter(prefix="/doctor", tags=["doctor"])


def _safe_average(values: list[int]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 2)


@router.get("/patients", response_model=list[PatientRead])
def get_doctor_patients(
    db: Session = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_roles("doctor")),
) -> list[Patient]:
    doctor_id = str(current_user.get("sub", ""))
    return list(
        db.scalars(
            select(Patient).where(Patient.doctor_id == doctor_id).order_by(Patient.name)
        ).all()
    )


@router.get("/dashboard/{patient_id}", response_model=DoctorDashboardResponse)
def get_doctor_dashboard(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_roles("doctor")),
) -> DoctorDashboardResponse:
    doctor_id = str(current_user.get("sub", ""))
    patient = db.scalar(
        select(Patient)
        .options(
            selectinload(Patient.assessments).selectinload(Assessment.session),
            selectinload(Patient.assessments).selectinload(Assessment.clock_drawing_submission),
            selectinload(Patient.assessments).selectinload(Assessment.speech_metrics),
            selectinload(Patient.assessments).selectinload(Assessment.facial_metrics),
            selectinload(Patient.assessments).selectinload(Assessment.ai_report),
        )
        .where(Patient.id == patient_id, Patient.doctor_id == doctor_id)
    )
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found for this doctor.",
        )

    patient.assessments.sort(key=lambda item: item.date, reverse=True)

    trend = TrendSummary(
        recall_avg=_safe_average([item.recall_score for item in patient.assessments]),
        drawing_avg=_safe_average([item.drawing_score for item in patient.assessments]),
        fluency_avg=_safe_average([item.fluency_score for item in patient.assessments]),
    )

    latest_report = None
    for assessment in patient.assessments:
        if assessment.ai_report is not None:
            latest_report = assessment.ai_report
            break

    return DoctorDashboardResponse(
        patient=patient,
        assessments=patient.assessments,
        latest_report=latest_report,
        trend=trend,
    )
