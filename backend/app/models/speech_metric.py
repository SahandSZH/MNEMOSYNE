from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.assessment import Assessment


class SpeechMetric(Base):
    __tablename__ = "speech_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    word_count: Mapped[int] = mapped_column(Integer, nullable=False)
    speech_rate: Mapped[float] = mapped_column(Float, nullable=False)
    vocabulary_diversity: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    assessment: Mapped["Assessment"] = relationship(back_populates="speech_metrics")
