from __future__ import annotations

import re
from typing import TypedDict


WORD_PATTERN = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")


class SpeechMetrics(TypedDict):
    total_word_count: int
    unique_word_count: int
    speech_rate: float


class SpeechFeatureVector(TypedDict):
    word_count: int
    vocabulary_diversity: float
    speech_rate: float


def tokenize_words(transcript: str) -> list[str]:
    """Lowercase tokenizer for basic transcript analysis."""
    if not transcript:
        return []

    return [match.group(0).lower() for match in WORD_PATTERN.finditer(transcript)]


def extract_speech_metrics(transcript: str, duration_seconds: float) -> SpeechMetrics:
    """
    Extract basic speech metrics:
    - total_word_count
    - unique_word_count
    - speech_rate (words per minute)
    """
    if duration_seconds <= 0:
        raise ValueError("duration_seconds must be > 0")

    words = tokenize_words(transcript)
    total_word_count = len(words)
    unique_word_count = len(set(words))
    speech_rate = (total_word_count / duration_seconds) * 60.0

    return SpeechMetrics(
        total_word_count=total_word_count,
        unique_word_count=unique_word_count,
        speech_rate=round(speech_rate, 2),
    )


def extract_feature_vector(
    transcript: str, assessment_duration_seconds: float
) -> SpeechFeatureVector:
    """
    Build the model feature vector required by downstream analysis.

    Returns:
    {
      "word_count": int,
      "vocabulary_diversity": float,  # unique_word_count / word_count
      "speech_rate": float            # words per minute
    }
    """
    metrics = extract_speech_metrics(transcript, assessment_duration_seconds)
    word_count = metrics["total_word_count"]
    unique_word_count = metrics["unique_word_count"]
    vocabulary_diversity = (unique_word_count / word_count) if word_count else 0.0

    return SpeechFeatureVector(
        word_count=word_count,
        vocabulary_diversity=round(vocabulary_diversity, 4),
        speech_rate=metrics["speech_rate"],
    )
