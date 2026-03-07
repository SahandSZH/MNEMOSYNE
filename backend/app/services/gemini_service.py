from app.config import settings


class GeminiService:
    def __init__(self) -> None:
        self.api_key = settings.gemini_api_key

    def generate_assessment_report(
        self,
        recall_score: int,
        clock_score: int,
        fluency_score: int,
        faq_score: int,
        behavior_score: int,
    ) -> dict[str, str]:
        # Placeholder implementation.
        avg_score = (
            recall_score + clock_score + fluency_score + faq_score + behavior_score
        ) / 5.0

        if avg_score >= 7.0:
            risk_level = "low"
        elif avg_score >= 4.0:
            risk_level = "moderate"
        else:
            risk_level = "high"

        summary = (
            "Placeholder Gemini assessment summary. "
            f"Average cognitive score is {avg_score:.2f}. "
            "Integrate Gemini API to produce clinical-quality narrative insights."
        )

        return {
            "summary": summary,
            "risk_level": risk_level,
        }
