import { config } from "./config.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const MAX_DRAWING_IMAGES = 3;
const MAX_IMAGE_BYTES = 1_500_000;
const GEMINI_MAX_RETRIES = 3;

const toStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item === null || item === undefined ? "" : String(item).trim()))
    .filter(Boolean);
};

const toTrimmedText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const parseJsonCandidate = (rawText) => {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();

  const direct = (() => {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  })();
  if (direct) return direct;

  const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      return null;
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }

  return null;
};

const parseImageDataUrl = (dataUrl) => {
  const trimmed = toTrimmedText(dataUrl);
  const matched = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!matched) return null;
  const mimeType = matched[1];
  const base64Data = matched[2];
  const estimatedBytes = Math.floor((base64Data.length * 3) / 4);
  if (estimatedBytes <= 0 || estimatedBytes > MAX_IMAGE_BYTES) return null;
  return {
    mimeType,
    base64Data,
    estimatedBytes,
  };
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });

const parseRetryAfterMs = (headerValue) => {
  if (!headerValue) return null;
  const asNumber = Number(headerValue);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.round(asNumber * 1000);
  }
  const parsedDate = new Date(headerValue);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return Math.max(0, parsedDate.getTime() - Date.now());
};

const estimateDrawingScoreFromPreparedImages = (geminiInputContract, preparedDrawingImages) => {
  const completionRatio = clamp(Number(geminiInputContract?.drawingScore?.completionRatio || 0), 0, 1);
  const imageBytes = preparedDrawingImages
    .map((image) => Number(image?.estimatedBytes || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!imageBytes.length) return null;

  const avgBytes = imageBytes.reduce((acc, value) => acc + value, 0) / imageBytes.length;
  const complexity = clamp((avgBytes - 6000) / (90000 - 6000), 0, 1);
  const score = clamp(completionRatio * 0.4 + complexity * 0.6, 0, 1) * 100;
  return Number(score.toFixed(1));
};

const buildPrompt = (geminiInputContract, drawingImageLabels = []) => `
You are assisting a remote cognitive monitoring system for doctors.
You must NOT diagnose dementia or provide diagnostic claims.
You must provide only monitoring-oriented observations from the provided data.
You are also evaluating drawing task quality as a behavioral/cognitive support signal only.

Return ONLY valid JSON with this exact schema:
{
  "clinical_summary": "string",
  "possible_decline_signals": ["string"],
  "contributing_factors": ["string"],
  "drawing_quality_score": number,
  "drawing_quality_notes": "string",
  "confidence": number
}

Rules:
- Keep the summary concise and clinical.
- If data quality is limited, explicitly say so in contributing_factors.
- drawing_quality_score must be in range [0, 100].
- drawing_quality_notes should briefly explain image-based observations if images are provided.
- Never claim diagnosis. Use wording like "monitoring signal", "observed pattern", "follow-up recommended".
- confidence must be in range [0, 1].
- Do not include markdown, code fences, or extra keys.
- If no drawing image is provided, estimate drawing_quality_score only from drawing metadata and state this limitation in drawing_quality_notes.

Input data:
${JSON.stringify(geminiInputContract, null, 2)}

Attached drawing images in this request:
${drawingImageLabels.length ? drawingImageLabels.map((label) => `- ${label}`).join("\n") : "- none"}
`;

const normalizeModelReport = (candidate, fallbackSummary) => {
  const clinicalSummary =
    typeof candidate?.clinical_summary === "string" && candidate.clinical_summary.trim()
      ? candidate.clinical_summary.trim()
      : typeof candidate?.clinicalSummary === "string" && candidate.clinicalSummary.trim()
        ? candidate.clinicalSummary.trim()
      : fallbackSummary.summaryText;

  const possibleDeclineSignals = toStringArray(
    candidate?.possible_decline_signals ?? candidate?.possibleDeclineSignals,
  );
  const contributingFactors = toStringArray(
    candidate?.contributing_factors ?? candidate?.contributingFactors,
  );
  const candidateConfidence = Number(candidate?.confidence ?? candidate?.summary_confidence);
  const confidence = Number.isFinite(candidateConfidence)
    ? clamp(candidateConfidence, 0, 1)
    : clamp(Number(fallbackSummary.summaryConfidence || 0), 0, 1);

  const candidateDrawingScore = Number(
    candidate?.drawing_quality_score ?? candidate?.drawingQualityScore,
  );
  const fallbackDrawingScore = Number(fallbackSummary?.drawingQualityScore);
  const drawingQualityScore = Number.isFinite(candidateDrawingScore)
    ? clamp(candidateDrawingScore, 0, 100)
    : Number.isFinite(fallbackDrawingScore)
      ? clamp(fallbackDrawingScore, 0, 100)
      : null;

  const drawingQualityNotes =
    typeof candidate?.drawing_quality_notes === "string" && candidate.drawing_quality_notes.trim()
      ? candidate.drawing_quality_notes.trim()
      : typeof candidate?.drawingQualityNotes === "string" && candidate.drawingQualityNotes.trim()
        ? candidate.drawingQualityNotes.trim()
      : toTrimmedText(fallbackSummary?.drawingQualityNotes || "Drawing quality could not be assessed.");

  return {
    clinicalSummary,
    possibleDeclineSignals,
    contributingFactors,
    drawingQualityScore:
      drawingQualityScore === null ? null : Number(drawingQualityScore.toFixed(1)),
    drawingQualityNotes,
    confidence: Number(confidence.toFixed(3)),
  };
};

const computeFallbackDrawingAssessment = (geminiInputContract, preparedDrawingImages) => {
  const completedTasks = Number(geminiInputContract?.drawingScore?.completedTasks || 0);
  const totalTasks = Number(geminiInputContract?.drawingScore?.totalTasks || 0);
  const heuristicScore = estimateDrawingScoreFromPreparedImages(
    geminiInputContract,
    preparedDrawingImages,
  );

  let note = "Drawing quality score unavailable because image analysis did not run.";
  if (heuristicScore !== null) {
    note =
      "Drawing quality score is heuristic (stroke-density + completion) because Gemini image scoring was rate-limited.";
  } else if (totalTasks > 0) {
    note = `Drawing completion was ${completedTasks}/${totalTasks}; image-based quality scoring is unavailable.`;
  }

  return {
    drawingQualityScore: heuristicScore,
    drawingQualityNotes: note,
  };
};

const buildFallbackReport = (
  fallbackSummary,
  reason,
  geminiInputContract,
  preparedDrawingImages = [],
) => {
  const possibleDeclineSignals = (fallbackSummary.contributingSignals || [])
    .filter((signal) => signal.direction === "down")
    .slice(0, 3)
    .map((signal) => `${signal.signal} trend moved down (delta ${signal.delta}).`);

  const contributingFactors = (fallbackSummary.contributingSignals || [])
    .slice(0, 4)
    .map((signal) => signal.note);

  if (!contributingFactors.length) {
    contributingFactors.push("Limited multimodal history; interpretation confidence is reduced.");
  }

  const drawingFallback = computeFallbackDrawingAssessment(
    geminiInputContract,
    preparedDrawingImages,
  );

  return {
    source: "fallback",
    model: "heuristic",
    status: "fallback",
    clinicalSummary: fallbackSummary.summaryText,
    possibleDeclineSignals,
    contributingFactors,
    drawingQualityScore: drawingFallback.drawingQualityScore,
    drawingQualityNotes: drawingFallback.drawingQualityNotes,
    confidence: Number(clamp(Number(fallbackSummary.summaryConfidence || 0), 0, 1).toFixed(3)),
    error: reason || null,
    rawResponseText: null,
  };
};

export async function generateGeminiMonitoringReport({
  geminiInputContract,
  fallbackSummary,
  drawingImages = [],
}) {
  const preparedDrawingImages = drawingImages
    .slice(0, MAX_DRAWING_IMAGES)
    .map((entry, index) => {
      const parsed = parseImageDataUrl(entry?.dataUrl);
      if (!parsed) return null;
      return {
        label: toTrimmedText(entry?.label || `drawing-${index + 1}`),
        ...parsed,
      };
    })
    .filter(Boolean);

  if (!config.geminiEnabled || !config.geminiApiKey) {
    return buildFallbackReport(
      fallbackSummary,
      !config.geminiEnabled ? "Gemini disabled by configuration." : "Missing GEMINI_API_KEY.",
      geminiInputContract,
      preparedDrawingImages,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, config.geminiTimeoutMs));
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    config.geminiModel,
  )}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

  try {
    const promptText = buildPrompt(
      geminiInputContract,
      preparedDrawingImages.map((image) => image.label),
    );
    const requestParts = [{ text: promptText }];
    for (const drawingImage of preparedDrawingImages) {
      requestParts.push({
        text: `Drawing image context: ${drawingImage.label}`,
      });
      requestParts.push({
        inlineData: {
          mimeType: drawingImage.mimeType,
          data: drawingImage.base64Data,
        },
      });
    }

    for (let attempt = 0; attempt < GEMINI_MAX_RETRIES; attempt += 1) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: requestParts,
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });

      const rawBodyText = await response.text();
      if (!response.ok) {
        const isLastAttempt = attempt >= GEMINI_MAX_RETRIES - 1;
        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        const isRateLimited = response.status === 429;
        if (isRateLimited && !isLastAttempt) {
          const backoffMs =
            retryAfterMs ?? Math.min(10000, Math.round(1200 * 2 ** attempt + Math.random() * 250));
          await sleep(backoffMs);
          continue;
        }

        const detail = rawBodyText ? `HTTP ${response.status}: ${rawBodyText}` : `HTTP ${response.status}`;
        return buildFallbackReport(
          fallbackSummary,
          `Gemini request failed (${detail}).`,
          geminiInputContract,
          preparedDrawingImages,
        );
      }

      const parsedBody = (() => {
        try {
          return JSON.parse(rawBodyText);
        } catch {
          return null;
        }
      })();

      const candidateText = parsedBody?.candidates
        ?.flatMap((candidate) => candidate?.content?.parts || [])
        ?.map((part) => part?.text || "")
        ?.join("\n")
        ?.trim();

      const parsedCandidate = parseJsonCandidate(candidateText);
      if (!parsedCandidate) {
        return buildFallbackReport(
          fallbackSummary,
          "Gemini response was not valid JSON for the required schema.",
          geminiInputContract,
          preparedDrawingImages,
        );
      }

      const normalized = normalizeModelReport(parsedCandidate, fallbackSummary);
      return {
        source: "gemini",
        model: config.geminiModel,
        status: "generated",
        ...normalized,
        error: null,
        rawResponseText: candidateText || null,
      };
    }

    return buildFallbackReport(
      fallbackSummary,
      "Gemini request retries exhausted due rate limiting.",
      geminiInputContract,
      preparedDrawingImages,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gemini error.";
    return buildFallbackReport(
      fallbackSummary,
      `Gemini call error: ${message}`,
      geminiInputContract,
      preparedDrawingImages,
    );
  } finally {
    clearTimeout(timeout);
  }
}
