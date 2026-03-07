from __future__ import annotations

import json
import os
from typing import Any, TypedDict

from .feature_extraction import extract_feature_vector
from .risk_scoring import detect_decline_risk


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
ALLOWED_RISK_LEVELS = {"stable", "possible_decline", "needs_review"}


class ClinicalAnalysisOutput(TypedDict):
    risk_level: str
    summary: str
    key_factors: list[str]


def _normalize_risk_level(value: Any, fallback: str | None = None) -> str:
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ALLOWED_RISK_LEVELS:
            return normalized

    if fallback and fallback in ALLOWED_RISK_LEVELS:
        return fallback

    return "needs_review"


def _parse_model_json(
    raw_text: str, fallback_risk_level: str | None = None
) -> ClinicalAnalysisOutput:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "Gemini did not return valid JSON. Ensure response_mime_type is application/json."
        ) from exc

    if not isinstance(payload, dict):
        raise RuntimeError("Gemini response JSON must be an object.")

    risk_level = _normalize_risk_level(payload.get("risk_level"), fallback_risk_level)
    summary = str(payload.get("summary", "")).strip()
    if not summary:
        raise RuntimeError("Gemini response is missing a non-empty 'summary' field.")

    factors_raw = payload.get("key_factors", [])
    if isinstance(factors_raw, list):
        key_factors = [str(item).strip() for item in factors_raw if str(item).strip()]
    else:
        key_factors = []

    if not key_factors:
        key_factors = ["No key factors were provided by Gemini."]

    return ClinicalAnalysisOutput(
        risk_level=risk_level,
        summary=summary,
        key_factors=key_factors,
    )


def _build_prompt(
    *,
    recall_score: float,
    clock_drawing_score: float,
    fluency_score: float,
    faq_score: float,
    behavior_symptoms: str,
    speech_rate: float,
    rule_based_risk_level: str,
    rule_based_key_factors: list[str],
) -> str:
    factors = ", ".join(rule_based_key_factors)

    return f"""You are a clinical assistant analyzing dementia monitoring data.

Patient cognitive data:
Recall score: {recall_score}
Clock drawing: {clock_drawing_score}
Fluency score: {fluency_score}
FAQ score: {faq_score}
Behavior symptoms: {behavior_symptoms}
Speech rate: {speech_rate}

Rule-based risk classification (authoritative):
Risk level: {rule_based_risk_level}
Contributing factors: {factors}

Write:
1. Clinical summary
2. Risk classification
3. Key contributing factors

Return ONLY valid JSON with this schema:
{{
  "risk_level": "stable | possible_decline | needs_review",
  "summary": "string",
  "key_factors": ["string", "string"]
}}
Use the same risk_level as the rule-based risk classification unless there is obvious contradictory evidence."""


def generate_clinical_summary(
    *,
    recall_score: float,
    clock_drawing_score: float,
    fluency_score: float,
    faq_score: float,
    behavior_symptoms: str,
    speech_rate: float,
    rule_based_risk_level: str,
    rule_based_key_factors: list[str],
    api_key: str | None = None,
    model: str = DEFAULT_GEMINI_MODEL,
) -> ClinicalAnalysisOutput:
    """
    Generate a clinical summary using Gemini and return JSON-ready output.
    """
    resolved_api_key = api_key or os.getenv("GEMINI_API_KEY")
    if not resolved_api_key:
        raise ValueError("Missing Gemini API key. Set GEMINI_API_KEY or pass api_key.")

    try:
        from google import genai
    except Exception as exc:  # pragma: no cover - runtime dependency
        raise RuntimeError(
            "google-genai package is not installed. Install it with: pip install google-genai"
        ) from exc

    client = genai.Client(api_key=resolved_api_key)
    prompt = _build_prompt(
        recall_score=recall_score,
        clock_drawing_score=clock_drawing_score,
        fluency_score=fluency_score,
        faq_score=faq_score,
        behavior_symptoms=behavior_symptoms,
        speech_rate=speech_rate,
        rule_based_risk_level=rule_based_risk_level,
        rule_based_key_factors=rule_based_key_factors,
    )

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_json_schema": {
                "type": "object",
                "properties": {
                    "risk_level": {
                        "type": "string",
                        "enum": ["stable", "possible_decline", "needs_review"],
                    },
                    "summary": {"type": "string"},
                    "key_factors": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["risk_level", "summary", "key_factors"],
            },
        },
    )

    return _parse_model_json(
        response.text or "",
        fallback_risk_level=rule_based_risk_level,
    )


def analyze_patient_sample(
    *,
    transcript: str,
    assessment_duration_seconds: float,
    recall_score: float,
    clock_drawing_score: float,
    fluency_score: float,
    faq_score: float,
    behavior_symptoms: str,
    gemini_api_key: str | None = None,
    gemini_model: str = DEFAULT_GEMINI_MODEL,
) -> ClinicalAnalysisOutput:
    """
    End-to-end helper for FastAPI:
    transcript -> speech features -> rule-based risk -> Gemini summary -> final JSON.
    """
    speech_features = extract_feature_vector(transcript, assessment_duration_seconds)
    risk_result = detect_decline_risk(
        fluency_score=fluency_score,
        faq_score=faq_score,
        recall_score=recall_score,
    )

    model_output = generate_clinical_summary(
        recall_score=recall_score,
        clock_drawing_score=clock_drawing_score,
        fluency_score=fluency_score,
        faq_score=faq_score,
        behavior_symptoms=behavior_symptoms,
        speech_rate=speech_features["speech_rate"],
        rule_based_risk_level=risk_result["risk_level"],
        rule_based_key_factors=risk_result["key_factors"],
        api_key=gemini_api_key,
        model=gemini_model,
    )

    merged_factors = list(
        dict.fromkeys(risk_result["key_factors"] + model_output["key_factors"])
    )

    return ClinicalAnalysisOutput(
        risk_level=risk_result["risk_level"],
        summary=model_output["summary"],
        key_factors=merged_factors,
    )
