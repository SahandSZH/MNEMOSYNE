from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import extract_roles, require_roles
from app.database import get_db
from app.models.assessment import Assessment
from app.models.patient import Patient
from app.schemas.patient import PatientWithAssessments


router = APIRouter(prefix="/patient", tags=["patients"])


@router.get("/{id}", response_model=PatientWithAssessments)
def get_patient_with_assessments(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict[str, Any] = Depends(
        require_roles("doctor", "patient", "caregiver")
    ),
) -> Patient:
    patient = db.scalar(
        select(Patient)
        .options(
            selectinload(Patient.assessments).selectinload(Assessment.speech_metrics),
            selectinload(Patient.assessments).selectinload(Assessment.ai_report),
        )
        .where(Patient.id == id)
    )
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        )

    user_roles = set(extract_roles(current_user))
    if "doctor" in user_roles and patient.doctor_id != current_user.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor can only access assigned patients.",
        )

    patient.assessments.sort(key=lambda item: item.date, reverse=True)
    return patient
