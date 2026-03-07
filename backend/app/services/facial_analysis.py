from __future__ import annotations

from datetime import datetime
from typing import Any

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.ai_report import AIReport
from app.models.assessment import Assessment
from app.models.facial_metric import FacialMetric
from app.services.gemini_service import GeminiService


class FacialAnalysisService:
    def __init__(self, gemini_service: GeminiService | None = None) -> None:
        self.gemini_service = gemini_service or GeminiService()
        self.presage_api_key = settings.presage_api_key
        self.presage_api_url = settings.presage_api_url
        self.presage_timeout_seconds = settings.presage_timeout_seconds

    @staticmethod
    def validate_facial_metrics(facial_metrics: dict[str, Any]) -> None:
        required_fields = {
            "face_presence_score": (0.0, 1.0),
            "eye_focus_score": (0.0, 1.0),
            "expression_variability": (0.0, 1.0),
        }

        for field_name, (min_value, max_value) in required_fields.items():
            value = float(facial_metrics.get(field_name, -1))
            if not min_value <= value <= max_value:
                raise ValueError(
                    f"{field_name} must be between {min_value} and {max_value}."
                )

        blink_rate = int(facial_metrics.get("blink_rate", -1))
        if blink_rate < 0 or blink_rate > 120:
            raise ValueError("blink_rate must be between 0 and 120.")

    def save_facial_metrics(
        self,
        db: Session,
        assessment_id: int,
        facial_metrics: dict[str, Any],
    ) -> FacialMetric:
        metric = db.scalar(
            select(FacialMetric).where(FacialMetric.assessment_id == assessment_id)
        )
        if metric is None:
            metric = FacialMetric(assessment_id=assessment_id)
            db.add(metric)

        metric.face_presence_score = float(facial_metrics["face_presence_score"])
        metric.blink_rate = int(facial_metrics["blink_rate"])
        metric.eye_focus_score = float(facial_metrics["eye_focus_score"])
        metric.expression_variability = float(facial_metrics["expression_variability"])
        metric.timestamp = datetime.utcnow()
        db.flush()
        return metric

    def build_presage_payload(
        self,
        assessment: Assessment,
        facial_metrics: dict[str, Any],
    ) -> dict[str, Any]:
        speech_metrics: dict[str, Any] = {}
        if assessment.speech_metrics is not None:
            speech_metrics = {
                "word_count": assessment.speech_metrics.word_count,
                "speech_rate": assessment.speech_metrics.speech_rate,
            }

        cognitive_scores = {
            "recall_score": assessment.recall_score,
            "drawing_score": assessment.drawing_score,
            "fluency_score": assessment.fluency_score,
        }

        return {
            "speech_metrics": speech_metrics,
            "cognitive_scores": cognitive_scores,
            "facial_metrics": facial_metrics,
        }

    def send_to_presage(self, presage_payload: dict[str, Any]) -> dict[str, Any]:
        if not self.presage_api_key or not self.presage_api_url:
            return {
                "behavioral_risk": "unavailable",
                "risk_score": None,
                "source": "presage_placeholder_not_configured",
            }

        try:
            response = requests.post(
                self.presage_api_url,
                json=presage_payload,
                headers={
                    "Authorization": f"Bearer {self.presage_api_key}",
                    "Content-Type": "application/json",
                },
                timeout=self.presage_timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json() if response.content else {}
        except requests.RequestException:
            return {
                "behavioral_risk": "unavailable",
                "risk_score": None,
                "source": "presage_placeholder_request_failed",
            }

        return {
            "behavioral_risk": str(payload.get("behavioral_risk", "unavailable")),
            "risk_score": payload.get("risk_score"),
            "source": "presage",
            "raw": payload,
        }

    def refresh_ai_report(
        self,
        db: Session,
        assessment: Assessment,
        facial_metric: FacialMetric,
        presage_result: dict[str, Any],
    ) -> AIReport:
        speech_payload: dict[str, Any] | None = None
        if assessment.speech_metrics is not None:
            speech_payload = {
                "word_count": assessment.speech_metrics.word_count,
                "speech_rate": assessment.speech_metrics.speech_rate,
            }

        report_data = self.gemini_service.generate_assessment_report(
            recall_score=assessment.recall_score,
            drawing_score=assessment.drawing_score,
            fluency_score=assessment.fluency_score,
            speech_metrics=speech_payload,
            facial_metrics={
                "face_presence_score": facial_metric.face_presence_score,
                "blink_rate": facial_metric.blink_rate,
                "eye_focus_score": facial_metric.eye_focus_score,
                "expression_variability": facial_metric.expression_variability,
            },
            presage_signal=presage_result,
        )

        if assessment.ai_report is None:
            assessment.ai_report = AIReport(
                assessment_id=assessment.id,
                summary=report_data["summary"],
                risk_level=report_data["risk_level"],
            )
            db.add(assessment.ai_report)
        else:
            assessment.ai_report.summary = report_data["summary"]
            assessment.ai_report.risk_level = report_data["risk_level"]

        db.flush()
        return assessment.ai_report

    def process_facial_metrics(
        self,
        db: Session,
        assessment: Assessment,
        facial_metrics: dict[str, Any],
    ) -> tuple[FacialMetric, dict[str, Any]]:
        self.validate_facial_metrics(facial_metrics)
        metric = self.save_facial_metrics(db, assessment.id, facial_metrics)
        presage_payload = self.build_presage_payload(assessment, facial_metrics)
        presage_result = self.send_to_presage(presage_payload)
        self.refresh_ai_report(
            db=db,
            assessment=assessment,
            facial_metric=metric,
            presage_result=presage_result,
        )
        db.commit()
        db.refresh(metric)
        return metric, presage_result
