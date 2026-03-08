import { config } from "./config.js";
import { withTransaction } from "./db.js";

const SCORE_MIN = 0;
const SCORE_MAX = 100;
const RETRY_BASE_DELAY_MS = 400;

const createStatusError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const parseJsonCandidate = (rawText) => {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with fallback extraction below.
  }

  const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue.
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

const readFromObject = (source, keys) => {
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = toText(source[key]);
      if (value) return value;
    }
  }
  return null;
};

const parseDataUrlImage = (rawValue) => {
  const value = toText(rawValue);
  if (!value) return null;

  const match = value.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  if (!match) {
    throw new Error("Invalid data URL format.");
  }

  const mimeType = toText(match[1]).toLowerCase();
  if (!mimeType.startsWith("image/")) {
    throw new Error(`Unsupported MIME type: ${mimeType || "unknown"}.`);
  }

  const base64Data = toText(match[2]).replace(/\s+/g, "");
  if (!base64Data) {
    throw new Error("Image payload is empty.");
  }

  let byteLength = 0;
  try {
    const decoded = Buffer.from(base64Data, "base64");
    byteLength = decoded.length;
  } catch {
    throw new Error("Base64 payload is invalid.");
  }

  if (!byteLength) {
    throw new Error("Decoded image payload is empty.");
  }

  return {
    mimeType,
    base64Data,
  };
};

const buildPrompt = () => `
You are scoring three cognitive-test drawings for quality/completeness.
Return STRICT JSON only (no markdown, no code fences, no extra text) with this exact schema:
{
  "drawing_1_score": number | null,
  "drawing_2_score": number | null,
  "drawing_3_score": number | null
}

Rules:
- Score range is 0 to 100.
- Higher score means better completion/quality for the intended drawing task.
- If a drawing is missing or unreadable, return null for that drawing score.
- Do NOT provide diagnosis or medical conclusions.
`;

const buildGeminiParts = (drawingSlots) => {
  const parts = [{ text: buildPrompt() }];

  for (const slot of drawingSlots) {
    parts.push({ text: `Drawing ${slot.index}:` });
    if (slot.image) {
      parts.push({
        inlineData: {
          mimeType: slot.image.mimeType,
          data: slot.image.base64Data,
        },
      });
    } else {
      parts.push({ text: `Drawing ${slot.index} image unavailable.` });
    }
  }

  return parts;
};

const isRetryableStatus = (statusCode) => statusCode === 429 || statusCode >= 500;

const isRetryableError = (error) => {
  if (!error) return false;
  const name = toText(error.name);
  if (name === "AbortError") return true;
  const message = toText(error.message).toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractCandidateText = (responseJson) =>
  responseJson?.candidates
    ?.flatMap((candidate) => candidate?.content?.parts || [])
    ?.map((part) => toText(part?.text))
    ?.filter(Boolean)
    ?.join("\n")
    ?.trim() || "";

async function callGeminiDrawingScoring(parts) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    config.geminiModel,
  )}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

  const maxAttempts = config.geminiDrawingMaxRetries + 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.geminiDrawingTimeoutMs);

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
              parts,
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });

      const rawBodyText = await response.text();
      if (!response.ok) {
        const safeBody = toText(rawBodyText).slice(0, 500);
        const error = new Error(
          safeBody
            ? `Gemini HTTP ${response.status}: ${safeBody}`
            : `Gemini HTTP ${response.status}.`,
        );

        if (attempt < maxAttempts && isRetryableStatus(response.status)) {
          await delay(RETRY_BASE_DELAY_MS * attempt);
          continue;
        }
        throw error;
      }

      let responseJson = null;
      try {
        responseJson = JSON.parse(rawBodyText);
      } catch {
        throw new Error("Gemini HTTP response was not valid JSON.");
      }

      const candidateText = extractCandidateText(responseJson);
      if (!candidateText) {
        throw new Error("Gemini response did not include candidate text.");
      }

      return {
        candidateText,
        model: config.geminiModel,
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts && isRetryableError(error)) {
        await delay(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Gemini drawing scoring failed.");
}

const normalizeScore = ({ value, key, allowNull, warnings }) => {
  if (value === null && allowNull) return null;
  if (value === null || value === undefined || value === "") {
    warnings.push(`${key} missing.`);
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    warnings.push(`${key} is not numeric.`);
    return null;
  }

  const clamped = clamp(numeric, SCORE_MIN, SCORE_MAX);
  if (clamped !== numeric) {
    warnings.push(`${key} was clamped to ${SCORE_MIN}-${SCORE_MAX}.`);
  }

  return Number(clamped.toFixed(2));
};

const parseGeminiDrawingScores = ({ candidateText, missingIndexes }) => {
  const parsed = parseJsonCandidate(candidateText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Gemini response was not valid JSON for drawing score schema.");
  }

  const warnings = [];

  const score1 = normalizeScore({
    value: parsed.drawing_1_score,
    key: "drawing_1_score",
    allowNull: missingIndexes.has(1),
    warnings,
  });
  const score2 = normalizeScore({
    value: parsed.drawing_2_score,
    key: "drawing_2_score",
    allowNull: missingIndexes.has(2),
    warnings,
  });
  const score3 = normalizeScore({
    value: parsed.drawing_3_score,
    key: "drawing_3_score",
    allowNull: missingIndexes.has(3),
    warnings,
  });

  return {
    scores: {
      drawing1Score: score1,
      drawing2Score: score2,
      drawing3Score: score3,
    },
    warnings,
  };
};

const mapPersistedSummary = (row) => ({
  assessmentId: Number(row.assessment_id),
  drawing1Score: row.drawing_1_score === null ? null : Number(row.drawing_1_score),
  drawing2Score: row.drawing_2_score === null ? null : Number(row.drawing_2_score),
  drawing3Score: row.drawing_3_score === null ? null : Number(row.drawing_3_score),
  geminiModel: toText(row.gemini_model) || null,
  scoredAt: toIsoOrNull(row.scored_at),
  scoringStatus: toText(row.scoring_status) || "error",
  scoringError: toText(row.scoring_error) || null,
});

const persistScores = async (client, assessmentId, payload) => {
  const result = await client.query(
    `
      INSERT INTO test1_drawing_results (
        assessment_id,
        drawing_1_score,
        drawing_2_score,
        drawing_3_score,
        gemini_model,
        scored_at,
        scoring_status,
        scoring_error
      )
      VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8)
      ON CONFLICT (assessment_id)
      DO UPDATE SET
        drawing_1_score = EXCLUDED.drawing_1_score,
        drawing_2_score = EXCLUDED.drawing_2_score,
        drawing_3_score = EXCLUDED.drawing_3_score,
        gemini_model = EXCLUDED.gemini_model,
        scored_at = EXCLUDED.scored_at,
        scoring_status = EXCLUDED.scoring_status,
        scoring_error = EXCLUDED.scoring_error
      RETURNING
        assessment_id,
        drawing_1_score,
        drawing_2_score,
        drawing_3_score,
        gemini_model,
        scored_at,
        scoring_status,
        scoring_error
    `,
    [
      assessmentId,
      payload.drawing1Score,
      payload.drawing2Score,
      payload.drawing3Score,
      payload.geminiModel,
      payload.scoredAt,
      payload.scoringStatus,
      payload.scoringError,
    ],
  );

  return result.rows[0];
};

const getDrawingSlotsFromRow = (row) => {
  const drawingsJson = row?.drawings_json && typeof row.drawings_json === "object" ? row.drawings_json : {};
  const attemptPayload =
    row?.attempt_payload && typeof row.attempt_payload === "object" ? row.attempt_payload : {};

  const payloadTestsDrawings = attemptPayload?.tests?.test1?.drawings || {};
  const payloadLegacyDrawings = attemptPayload?.testData?.test1Drawings || {};

  return [1, 2, 3].map((index) => {
    const stepKey = `step${index}`;
    const directColumn = toText(row?.[`${stepKey}_image_data_url`]) || null;
    const fromJson = readFromObject(drawingsJson, [stepKey, String(index)]);
    const fromTestsPayload = readFromObject(payloadTestsDrawings, [stepKey, String(index)]);
    const fromLegacyPayload = readFromObject(payloadLegacyDrawings, [stepKey, String(index)]);

    return {
      index,
      rawDataUrl: directColumn || fromJson || fromTestsPayload || fromLegacyPayload || null,
      image: null,
    };
  });
};

const loadAssessmentDrawingRow = async (client, assessmentId) => {
  const result = await client.query(
    `
      SELECT
        a.id AS assessment_id,
        t1.step1_image_data_url,
        t1.step2_image_data_url,
        t1.step3_image_data_url,
        dr.drawings_json,
        a.attempt_payload
      FROM assessments a
      LEFT JOIN test1_drawing_results t1 ON t1.assessment_id = a.id
      LEFT JOIN drawing_results dr ON dr.assessment_id = a.id
      WHERE a.id = $1
      LIMIT 1
    `,
    [assessmentId],
  );

  return result.rows[0] || null;
};

export async function scoreDrawingsForAssessment(assessmentIdInput) {
  const assessmentId = Number(assessmentIdInput);
  if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
    throw createStatusError(400, "assessment id must be a positive integer.");
  }

  return withTransaction(async (client) => {
    const row = await loadAssessmentDrawingRow(client, assessmentId);
    if (!row) {
      throw createStatusError(404, `Assessment ${assessmentId} was not found.`);
    }

    const drawingSlots = getDrawingSlotsFromRow(row);
    const inputWarnings = [];
    const missingIndexes = new Set();

    for (const slot of drawingSlots) {
      if (!slot.rawDataUrl) {
        missingIndexes.add(slot.index);
        inputWarnings.push(`drawing_${slot.index}_score source image missing.`);
        continue;
      }

      try {
        slot.image = parseDataUrlImage(slot.rawDataUrl);
      } catch (error) {
        missingIndexes.add(slot.index);
        inputWarnings.push(
          `drawing_${slot.index}_score source image invalid (${error instanceof Error ? error.message : "invalid image"}).`,
        );
      }
    }

    if (missingIndexes.size === 3) {
      const persisted = await persistScores(client, assessmentId, {
        drawing1Score: null,
        drawing2Score: null,
        drawing3Score: null,
        geminiModel: config.geminiModel,
        scoredAt: new Date().toISOString(),
        scoringStatus: "error",
        scoringError: "No valid drawing images found for scoring.",
      });
      return mapPersistedSummary(persisted);
    }

    if (!config.geminiEnabled || !config.geminiApiKey) {
      const persisted = await persistScores(client, assessmentId, {
        drawing1Score: null,
        drawing2Score: null,
        drawing3Score: null,
        geminiModel: config.geminiModel,
        scoredAt: new Date().toISOString(),
        scoringStatus: "error",
        scoringError: !config.geminiEnabled
          ? "Gemini drawing scoring is disabled by configuration."
          : "Missing GEMINI_API_KEY.",
      });
      return mapPersistedSummary(persisted);
    }

    try {
      const parts = buildGeminiParts(drawingSlots);
      const gemini = await callGeminiDrawingScoring(parts);
      const parsed = parseGeminiDrawingScores({
        candidateText: gemini.candidateText,
        missingIndexes,
      });

      const allWarnings = [...inputWarnings, ...parsed.warnings];
      const persisted = await persistScores(client, assessmentId, {
        drawing1Score: parsed.scores.drawing1Score,
        drawing2Score: parsed.scores.drawing2Score,
        drawing3Score: parsed.scores.drawing3Score,
        geminiModel: gemini.model,
        scoredAt: new Date().toISOString(),
        scoringStatus: allWarnings.length ? "fallback" : "success",
        scoringError: allWarnings.length ? allWarnings.join(" | ") : null,
      });

      return mapPersistedSummary(persisted);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gemini drawing scoring failed.";
      const persisted = await persistScores(client, assessmentId, {
        drawing1Score: null,
        drawing2Score: null,
        drawing3Score: null,
        geminiModel: config.geminiModel,
        scoredAt: new Date().toISOString(),
        scoringStatus: "error",
        scoringError: message,
      });

      return mapPersistedSummary(persisted);
    }
  });
}
