from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class AssessmentCreate(BaseModel):
    patient_id: int
    date: date | None = None
    recall_score: int = Field(ge=0)
    drawing_score: int = Field(ge=0)
    fluency_score: int = Field(ge=0)


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


class FacialMetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assessment_id: int
    face_presence_score: float
    blink_rate: int
    eye_focus_score: float
    expression_variability: float
    timestamp: datetime


class AssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    date: date
    recall_score: int
    drawing_score: int
    fluency_score: int
    speech_metrics: SpeechMetricRead | None = None
    facial_metrics: FacialMetricRead | None = None
    ai_report: AIReportRead | None = None


class SpeechUploadResponse(BaseModel):
    assessment_id: int
    transcript: str
    word_count: int
    speech_rate: float


class FacialMetricsPayload(BaseModel):
    face_presence_score: float = Field(ge=0.0, le=1.0)
    blink_rate: int = Field(ge=0, le=120)
    eye_focus_score: float = Field(ge=0.0, le=1.0)
    expression_variability: float = Field(ge=0.0, le=1.0)


class FacialBiometricCreate(BaseModel):
    patient_id: int
    session_id: str
    facial_metrics: FacialMetricsPayload


class FacialBiometricResponse(BaseModel):
    assessment_id: int
    patient_id: int
    session_id: str
    facial_metrics: FacialMetricsPayload
    presage_behavioral_risk: str | None = None
    presage_risk_score: float | None = None
