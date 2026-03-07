from __future__ import annotations

from typing import Any

from app.config import settings


class GeminiService:
    def __init__(self) -> None:
        self.api_key = settings.gemini_api_key

    @staticmethod
    def _safe_float(value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def generate_assessment_report(
        self,
        recall_score: int,
        drawing_score: int,
        fluency_score: int,
        speech_metrics: dict[str, Any] | None = None,
        facial_metrics: dict[str, Any] | None = None,
        presage_signal: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        # Placeholder heuristic that mirrors expected Gemini prompt output format.
        avg_score = (recall_score + drawing_score + fluency_score) / 3.0

        risk_points = 0
        contributing_factors: list[str] = []

        if avg_score < 4.0:
            risk_points += 2
            contributing_factors.append("Low average cognitive task performance.")
        elif avg_score < 7.0:
            risk_points += 1
            contributing_factors.append("Moderate cognitive task performance.")

        if speech_metrics:
            speech_rate = self._safe_float(speech_metrics.get("speech_rate"))
            if speech_rate is not None and speech_rate < 90:
                risk_points += 1
                contributing_factors.append("Lower-than-expected speech rate during fluency task.")

        if facial_metrics:
            eye_focus_score = self._safe_float(facial_metrics.get("eye_focus_score"))
            expression_variability = self._safe_float(
                facial_metrics.get("expression_variability")
            )
            face_presence_score = self._safe_float(facial_metrics.get("face_presence_score"))

            if eye_focus_score is not None and eye_focus_score < 0.6:
                risk_points += 1
                contributing_factors.append("Low eye engagement during speech task.")
            if expression_variability is not None and expression_variability < 0.35:
                risk_points += 1
                contributing_factors.append("Low facial expressiveness variability.")
            if face_presence_score is not None and face_presence_score < 0.85:
                contributing_factors.append("Intermittent face presence in webcam frame.")

        presage_label = None
        if presage_signal:
            presage_label = str(presage_signal.get("behavioral_risk", "")).strip().lower()
            if presage_label == "high":
                risk_points += 2
                contributing_factors.append("Presage behavioral biometric signal flagged high risk.")
            elif presage_label in {"moderate", "medium"}:
                risk_points += 1
                contributing_factors.append("Presage behavioral biometric signal flagged moderate risk.")

        if risk_points <= 1:
            risk_level = "low"
        elif risk_points <= 3:
            risk_level = "moderate"
        else:
            risk_level = "high"

        if not contributing_factors:
            contributing_factors.append("No elevated behavioral concern signals detected.")

        possible_decline_signals = ", ".join(contributing_factors[:3])

        summary = (
            "Clinical summary: Cognitive and behavioral indicators were analyzed for longitudinal monitoring. "
            f"Possible decline signals: {possible_decline_signals}. "
            f"Contributing factors: {' '.join(contributing_factors)} "
            "This output is a supportive behavioral signal and not a standalone diagnosis."
        )

        return {"summary": summary, "risk_level": risk_level}
