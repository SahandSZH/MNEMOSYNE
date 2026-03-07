from app.schemas.assessment import (
    AIReportRead,
    AssessmentCreate,
    AssessmentRead,
    SpeechMetricRead,
    SpeechUploadResponse,
)
from app.schemas.doctor import DoctorDashboardResponse, TrendSummary
from app.schemas.patient import PatientRead, PatientWithAssessments

__all__ = [
    "AssessmentCreate",
    "AssessmentRead",
    "SpeechMetricRead",
    "SpeechUploadResponse",
    "AIReportRead",
    "PatientRead",
    "PatientWithAssessments",
    "DoctorDashboardResponse",
    "TrendSummary",
]
