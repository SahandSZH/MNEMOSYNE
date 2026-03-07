from __future__ import annotations

from enum import Enum
from typing import TypedDict


class RiskLevel(str, Enum):
    STABLE = "stable"
    POSSIBLE_DECLINE = "possible_decline"
    NEEDS_REVIEW = "needs_review"


class RiskResult(TypedDict):
    risk_level: str
    risk_score: int
    key_factors: list[str]


def detect_decline_risk(
    fluency_score: float, faq_score: float, recall_score: float
) -> RiskResult:
    """
    Rule-based decline classification.

    Rules:
    - fluency_score < 10 -> +1 risk
    - faq_score >= 5 -> +1 risk
    - recall_score <= 1 -> +1 risk
    """
    risk_score = 0
    key_factors: list[str] = []

    if fluency_score < 10:
        risk_score += 1
        key_factors.append("Low fluency score (<10)")

    if faq_score >= 5:
        risk_score += 1
        key_factors.append("Elevated FAQ score (>=5)")

    if recall_score <= 1:
        risk_score += 1
        key_factors.append("Low recall score (<=1)")

    if risk_score == 0:
        risk_level = RiskLevel.STABLE.value
    elif risk_score == 1:
        risk_level = RiskLevel.POSSIBLE_DECLINE.value
    else:
        risk_level = RiskLevel.NEEDS_REVIEW.value

    if not key_factors:
        key_factors.append("No high-risk thresholds triggered")

    return RiskResult(
        risk_level=risk_level,
        risk_score=risk_score,
        key_factors=key_factors,
    )
