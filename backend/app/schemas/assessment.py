from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class AssessmentCreate(BaseModel):
    patient_id: int
    date: date | None = None
    recall_score: int = Field(ge=0)
    clock_score: int = Field(ge=0)
    fluency_score: int = Field(ge=0)
    faq_score: int = Field(ge=0)
    behavior_score: int = Field(ge=0)


class SpeechMetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assessment_id: int
    word_count: int
    speech_rate: float


class AIReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assessment_id: int
    summary: str
    risk_level: str


class AssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    date: date
    recall_score: int
    clock_score: int
    fluency_score: int
    faq_score: int
    behavior_score: int
    speech_metrics: SpeechMetricRead | None = None
    ai_report: AIReportRead | None = None


class SpeechUploadResponse(BaseModel):
    assessment_id: int
    transcript: str
    word_count: int
    speech_rate: float
