from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.assessment import Assessment


class FacialMetric(Base):
    __tablename__ = "facial_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    face_presence_score: Mapped[float] = mapped_column(Float, nullable=False)
    blink_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    eye_focus_score: Mapped[float] = mapped_column(Float, nullable=False)
    expression_variability: Mapped[float] = mapped_column(Float, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    assessment: Mapped["Assessment"] = relationship(back_populates="facial_metrics")
