from datetime import date as dt_date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.ai_report import AIReport
    from app.models.patient import Patient
    from app.models.speech_metric import SpeechMetric


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[dt_date] = mapped_column(Date, default=dt_date.today)
    recall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    clock_score: Mapped[int] = mapped_column(Integer, nullable=False)
    fluency_score: Mapped[int] = mapped_column(Integer, nullable=False)
    faq_score: Mapped[int] = mapped_column(Integer, nullable=False)
    behavior_score: Mapped[int] = mapped_column(Integer, nullable=False)

    patient: Mapped["Patient"] = relationship(back_populates="assessments")
    speech_metrics: Mapped["SpeechMetric"] = relationship(
        back_populates="assessment",
        uselist=False,
        cascade="all, delete-orphan",
    )
    ai_report: Mapped["AIReport"] = relationship(
        back_populates="assessment",
        uselist=False,
        cascade="all, delete-orphan",
    )
