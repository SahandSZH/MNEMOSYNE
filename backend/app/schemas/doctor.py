from pydantic import BaseModel, Field

from app.schemas.assessment import AIReportRead, AssessmentRead
from app.schemas.patient import PatientRead


class TrendSummary(BaseModel):
    recall_avg: float
    clock_avg: float
    fluency_avg: float
    faq_avg: float
    behavior_avg: float


class DoctorDashboardResponse(BaseModel):
    patient: PatientRead
    assessments: list[AssessmentRead] = Field(default_factory=list)
    latest_report: AIReportRead | None = None
    trend: TrendSummary
