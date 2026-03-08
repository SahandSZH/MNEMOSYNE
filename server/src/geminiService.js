import { config } from "./config.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item === null || item === undefined ? "" : String(item).trim()))
    .filter(Boolean);
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

const buildPrompt = (geminiInputContract) => `
You are assisting a remote cognitive monitoring system for doctors.
You must NOT diagnose dementia or provide diagnostic claims.
You must provide only monitoring-oriented observations from the provided data.

Return ONLY valid JSON with this exact schema:
{
  "clinical_summary": "string",
  "possible_decline_signals": ["string"],
  "contributing_factors": ["string"],
  "confidence": number
}

Rules:
- Keep the summary concise and clinical.
- If data quality is limited, explicitly say so in contributing_factors.
- confidence must be in range [0, 1].
- Do not include markdown, code fences, or extra keys.

Input data:
${JSON.stringify(geminiInputContract, null, 2)}
`;

const normalizeModelReport = (candidate, fallbackSummary) => {
  const clinicalSummary =
    typeof candidate?.clinical_summary === "string" && candidate.clinical_summary.trim()
      ? candidate.clinical_summary.trim()
      : fallbackSummary.summaryText;

  const possibleDeclineSignals = toStringArray(candidate?.possible_decline_signals);
  const contributingFactors = toStringArray(candidate?.contributing_factors);
  const candidateConfidence = Number(candidate?.confidence);
  const confidence = Number.isFinite(candidateConfidence)
    ? clamp(candidateConfidence, 0, 1)
    : clamp(Number(fallbackSummary.summaryConfidence || 0), 0, 1);

  return {
    clinicalSummary,
    possibleDeclineSignals,
    contributingFactors,
    confidence: Number(confidence.toFixed(3)),
  };
};

const buildFallbackReport = (fallbackSummary, reason) => {
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

  return {
    source: "fallback",
    model: "heuristic",
    status: "fallback",
    clinicalSummary: fallbackSummary.summaryText,
    possibleDeclineSignals,
    contributingFactors,
    confidence: Number(clamp(Number(fallbackSummary.summaryConfidence || 0), 0, 1).toFixed(3)),
    error: reason || null,
    rawResponseText: null,
  };
};

export async function generateGeminiMonitoringReport({ geminiInputContract, fallbackSummary }) {
  if (!config.geminiEnabled || !config.geminiApiKey) {
    return buildFallbackReport(
      fallbackSummary,
      !config.geminiEnabled ? "Gemini disabled by configuration." : "Missing GEMINI_API_KEY.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, config.geminiTimeoutMs));
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    config.geminiModel,
  )}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(geminiInputContract) }],
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
      const detail = rawBodyText ? `HTTP ${response.status}: ${rawBodyText}` : `HTTP ${response.status}`;
      return buildFallbackReport(fallbackSummary, `Gemini request failed (${detail}).`);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gemini error.";
    return buildFallbackReport(fallbackSummary, `Gemini call error: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}
