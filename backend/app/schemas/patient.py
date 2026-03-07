from pydantic import BaseModel, ConfigDict, Field

from app.schemas.assessment import AssessmentRead


class PatientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    age: int
    doctor_id: str


class PatientWithAssessments(PatientRead):
    assessments: list[AssessmentRead] = Field(default_factory=list)
