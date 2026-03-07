class ClockDrawingService:
    def analyze(self, image_bytes: bytes, filename: str) -> dict[str, int | str]:
        # Placeholder scoring heuristic until a real model is integrated.
        if not image_bytes:
            return {"drawing_score": 0, "analysis_notes": "No image content detected."}

        quality_signal = (len(image_bytes) + len(filename)) % 4
        drawing_score = int(quality_signal)

        if drawing_score >= 3:
            notes = "Clock drawing appears complete in placeholder analysis."
        elif drawing_score == 2:
            notes = "Clock drawing shows minor irregularities in placeholder analysis."
        elif drawing_score == 1:
            notes = "Clock drawing shows major irregularities in placeholder analysis."
        else:
            notes = "Clock drawing incomplete in placeholder analysis."

        return {"drawing_score": drawing_score, "analysis_notes": notes}
