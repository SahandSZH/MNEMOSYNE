import { config } from "./config.js";
import { query } from "./db.js";

const MAX_PATIENT_ASSESSMENTS = 10;

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const averageDefined = (values, fallback = 0) => {
  const defined = values.filter((value) => Number.isFinite(value));
  if (!defined.length) return fallback;
  return defined.reduce((sum, value) => sum + value, 0) / defined.length;
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const safeErrorMessage = (error) => {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown deep analysis failure");
};

const sanitizeError = (message) => String(message || "").replace(/\s+/g, " ").trim().slice(0, 400);

const toStringArray = (value, maxItems = 8) => {
  if (!Array.isArray(value)) return [];
  const unique = new Set();
  for (const item of value) {
    const text = String(item || "").trim();
    if (!text) continue;
    unique.add(text);
    if (unique.size >= maxItems) break;
  }
  return [...unique];
};

const asJsonString = (value) => JSON.stringify(value, null, 2);

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getAssessmentMetricsRows = async (patientId, limit = MAX_PATIENT_ASSESSMENTS) => {
  const normalizedPatientId = String(patientId || "").trim();
  if (!normalizedPatientId) {
    const error = new Error("Patient identifier is required.");
    error.status = 400;
    throw error;
  }

  const result = await query(
    `
      SELECT
        a.id AS assessment_id,
        a.patient_user_id::text AS patient_user_id,
        a.patient_sub,
        COALESCE(u.full_name, u.email, a.patient_sub, 'Unknown Patient') AS patient_name,
        a.captured_at,
        a.submitted_at,
        COALESCE(a.total_duration_seconds, 0) AS total_duration_seconds,

        COALESCE(mr.score, 0) AS memory_recall_score,
        COALESCE(mr.max_score, 0) AS memory_recall_max,
        COALESCE(mr.accuracy, 0) AS memory_recall_accuracy,

        COALESCE(mc.part1_correct_count, 0) AS memory_challenge_part1_correct,
        COALESCE(mc.part1_total_target, 0) AS memory_challenge_part1_total,
        COALESCE(mc.part3_correct_count, 0) AS memory_challenge_part3_correct,
        COALESCE(mc.part3_total_count, 0) AS memory_challenge_part3_total,

        COALESCE(sr.word_count, 0) AS speech_word_count,
        COALESCE(sr.speech_rate_wpm, 0) AS speech_rate_wpm,
        COALESCE(sr.vocabulary_diversity, 0) AS speech_vocabulary_diversity,
        COALESCE(sr.recall_accuracy, 0) AS speech_recall_accuracy,
        COALESCE(sr.matched_count, 0) AS speech_matched_count,
        COALESCE(sr.total_target_words, 0) AS speech_total_target_words,
        COALESCE(sr.skipped, false) AS speech_skipped,

        t1r.drawing_1_score,
        t1r.drawing_2_score,
        t1r.drawing_3_score,
        COALESCE(t1r.scoring_status, 'pending') AS drawing_scoring_status,
        t1r.scored_at AS drawing_scored_at,

        COALESCE(fm.session_quality, 'unavailable') AS session_quality,
        COALESCE(fm.facial_signals_status, 'unknown') AS facial_signals_status,
        COALESCE(fm.face_missing_events, 0) AS facial_face_missing_events,
        COALESCE(fm.face_missing_seconds, 0) AS facial_face_missing_seconds,
        COALESCE(fm.sample_count, 0) AS facial_sample_count
      FROM assessments a
      LEFT JOIN app_users u ON u.id = a.patient_user_id
      LEFT JOIN memory_recall_results mr ON mr.assessment_id = a.id
      LEFT JOIN memory_challenge_results mc ON mc.assessment_id = a.id
      LEFT JOIN speech_results sr ON sr.assessment_id = a.id
      LEFT JOIN test1_drawing_results t1r ON t1r.assessment_id = a.id
      LEFT JOIN facial_metrics fm ON fm.assessment_id = a.id
      WHERE a.patient_user_id::text = $1 OR a.patient_sub = $1
      ORDER BY a.captured_at DESC
      LIMIT $2
    `,
    [normalizedPatientId, Math.max(1, Math.min(20, Number(limit) || MAX_PATIENT_ASSESSMENTS))],
  );

  return result.rows;
};

const computeMemoryRecallPercent = (row) => {
  const max = toNumber(row.memory_recall_max, 0);
  const score = toNumber(row.memory_recall_score, 0);
  const accuracyRatio = clamp(toNumber(row.memory_recall_accuracy, 0), 0, 1);
  if (max > 0) return round(clamp((score / max) * 100, 0, 100), 2);
  return round(accuracyRatio * 100, 2);
};

const computeMemoryChallengePercent = (row) => {
  const part1Total = toNumber(row.memory_challenge_part1_total, 0);
  const part1Correct = toNumber(row.memory_challenge_part1_correct, 0);
  const part3Total = toNumber(row.memory_challenge_part3_total, 0);
  const part3Correct = toNumber(row.memory_challenge_part3_correct, 0);

  const parts = [];
  if (part1Total > 0) parts.push(clamp((part1Correct / part1Total) * 100, 0, 100));
  if (part3Total > 0) parts.push(clamp((part3Correct / part3Total) * 100, 0, 100));
  if (!parts.length) return null;
  return round(averageDefined(parts, 0), 2);
};

const computeSpeechRecallPercent = (row) => {
  const totalTarget = toNumber(row.speech_total_target_words, 0);
  const matched = toNumber(row.speech_matched_count, 0);
  if (totalTarget > 0) return round(clamp((matched / totalTarget) * 100, 0, 100), 2);
  return round(clamp(toNumber(row.speech_recall_accuracy, 0) * 100, 0, 100), 2);
};

const asNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const averageScore = (scores) => {
  const defined = scores.filter((value) => Number.isFinite(value));
  if (!defined.length) return null;
  return round(defined.reduce((sum, value) => sum + value, 0) / defined.length, 2);
};

const buildDeepAnalysisContract = (rows, patientId) => {
  const ordered = [...rows].reverse();
  const identityRow = ordered[ordered.length - 1];
  const patientName =
    String(identityRow?.patient_name || "").trim() || "Unknown Patient";
  const startAt = toIsoOrNull(ordered[0]?.captured_at);
  const endAt = toIsoOrNull(ordered[ordered.length - 1]?.captured_at);

  const points = ordered.map((row) => {
    const memoryRecallPercent = computeMemoryRecallPercent(row);
    const memoryChallengePercent = computeMemoryChallengePercent(row);
    const memoryCombinedPercent = round(
      averageDefined(
        [
          memoryRecallPercent,
          memoryChallengePercent === null ? Number.NaN : memoryChallengePercent,
        ],
        memoryRecallPercent,
      ),
      2,
    );
    const speechRecallPercent = computeSpeechRecallPercent(row);
    const drawingScores = [
      asNumberOrNull(row.drawing_1_score),
      asNumberOrNull(row.drawing_2_score),
      asNumberOrNull(row.drawing_3_score),
    ];
    const drawingAveragePercent = averageScore(drawingScores);
    const cognitiveCompositePercent = round(
      clamp(memoryCombinedPercent * 0.65 + speechRecallPercent * 0.35, 0, 100),
      2,
    );

    return {
      assessment_id: toNumber(row.assessment_id, 0),
      captured_at: toIsoOrNull(row.captured_at),
      submitted_at: toIsoOrNull(row.submitted_at),
      duration_seconds: round(toNumber(row.total_duration_seconds, 0), 2),
      memory_recall_percent: memoryRecallPercent,
      memory_challenge_percent: memoryChallengePercent,
      memory_combined_percent: memoryCombinedPercent,
      speech_recall_percent: speechRecallPercent,
      speech_word_count: toNumber(row.speech_word_count, 0),
      speech_rate_wpm: round(toNumber(row.speech_rate_wpm, 0), 2),
      speech_vocabulary_diversity_percent: round(
        clamp(toNumber(row.speech_vocabulary_diversity, 0), 0, 1) * 100,
        2,
      ),
      speech_skipped: Boolean(row.speech_skipped),
      drawing_scores: {
        drawing_1_score: drawingScores[0],
        drawing_2_score: drawingScores[1],
        drawing_3_score: drawingScores[2],
      },
      drawing_average_percent: drawingAveragePercent,
      drawing_scoring_status: String(row.drawing_scoring_status || "pending"),
      drawing_scored_at: toIsoOrNull(row.drawing_scored_at),
      session_quality: String(row.session_quality || "unavailable"),
      facial_signals_status: String(row.facial_signals_status || "unknown"),
      facial_face_missing_events: toNumber(row.facial_face_missing_events, 0),
      facial_face_missing_seconds: round(toNumber(row.facial_face_missing_seconds, 0), 2),
      facial_sample_count: toNumber(row.facial_sample_count, 0),
      cognitive_composite_percent: cognitiveCompositePercent,
    };
  });

  const memorySeries = points.map((point) => point.memory_combined_percent);
  const speechSeries = points.map((point) => point.speech_recall_percent);
  const cognitiveSeries = points.map((point) => point.cognitive_composite_percent);
  const drawingSeries = points
    .map((point) => point.drawing_average_percent)
    .filter((value) => Number.isFinite(value));

  const latest = points[points.length - 1];
  const earliest = points[0];

  const sessionQualityDistribution = points.reduce(
    (acc, point) => {
      const quality = point.session_quality;
      if (quality === "good") acc.good += 1;
      else if (quality === "limited") acc.limited += 1;
      else acc.unavailable += 1;
      return acc;
    },
    { good: 0, limited: 0, unavailable: 0 },
  );

  const missingDrawingScoreSessions = points.filter(
    (point) =>
      point.drawing_scores.drawing_1_score === null &&
      point.drawing_scores.drawing_2_score === null &&
      point.drawing_scores.drawing_3_score === null,
  ).length;
  const pendingDrawingSessions = points.filter(
    (point) => point.drawing_scoring_status === "pending",
  ).length;

  const dataQualityNotes = [];
  if (missingDrawingScoreSessions > 0) {
    dataQualityNotes.push(
      `${missingDrawingScoreSessions} assessment(s) are missing drawing scores.`,
    );
  }
  if (pendingDrawingSessions > 0) {
    dataQualityNotes.push(`${pendingDrawingSessions} assessment(s) are still pending drawing scoring.`);
  }
  const speechSkippedSessions = points.filter((point) => point.speech_skipped).length;
  if (speechSkippedSessions > 0) {
    dataQualityNotes.push(`${speechSkippedSessions} assessment(s) had skipped speech input.`);
  }

  const contract = {
    version: "1.0",
    purpose: "doctor_monitoring_deep_analysis",
    policy: {
      monitoring_only: true,
      no_diagnosis: true,
      no_treatment_recommendations: true,
    },
    patient: {
      patient_id: String(patientId),
      patient_name: patientName,
    },
    timeframe: {
      assessments_considered: points.length,
      start_at: startAt,
      end_at: endAt,
    },
    metrics: {
      memory: {
        latest_percent: latest.memory_combined_percent,
        average_percent: round(averageDefined(memorySeries, 0), 2),
        trend_delta: round(latest.memory_combined_percent - earliest.memory_combined_percent, 2),
      },
      speech: {
        latest_percent: latest.speech_recall_percent,
        average_percent: round(averageDefined(speechSeries, 0), 2),
        trend_delta: round(latest.speech_recall_percent - earliest.speech_recall_percent, 2),
        average_word_count: round(averageDefined(points.map((point) => point.speech_word_count), 0), 1),
        average_rate_wpm: round(averageDefined(points.map((point) => point.speech_rate_wpm), 0), 1),
      },
      drawing: {
        latest_scores: latest.drawing_scores,
        latest_average_percent: latest.drawing_average_percent,
        average_percent: drawingSeries.length
          ? round(averageDefined(drawingSeries, 0), 2)
          : null,
        trend_delta:
          drawingSeries.length >= 2
            ? round(drawingSeries[drawingSeries.length - 1] - drawingSeries[0], 2)
            : null,
        pending_sessions: pendingDrawingSessions,
      },
      cognitive_composite: {
        latest_percent: latest.cognitive_composite_percent,
        average_percent: round(averageDefined(cognitiveSeries, 0), 2),
        trend_delta: round(
          latest.cognitive_composite_percent - earliest.cognitive_composite_percent,
          2,
        ),
      },
      session_quality_distribution: sessionQualityDistribution,
      average_duration_seconds: round(
        averageDefined(points.map((point) => point.duration_seconds), 0),
        2,
      ),
    },
    data_quality: {
      coverage_ratio: round(
        ((points.length - missingDrawingScoreSessions) / Math.max(points.length, 1)) * 100,
        2,
      ),
      notes: dataQualityNotes,
    },
    series: points.map((point) => ({
      assessment_id: point.assessment_id,
      captured_at: point.captured_at,
      memory_combined_percent: point.memory_combined_percent,
      speech_recall_percent: point.speech_recall_percent,
      drawing_average_percent: point.drawing_average_percent,
      cognitive_composite_percent: point.cognitive_composite_percent,
      session_quality: point.session_quality,
    })),
  };

  return { contract, points };
};

const buildFallbackReport = ({ contract, reason }) => {
  const memoryTrend = toNumber(contract.metrics.memory.trend_delta, 0);
  const speechTrend = toNumber(contract.metrics.speech.trend_delta, 0);
  const cognitiveTrend = toNumber(contract.metrics.cognitive_composite.trend_delta, 0);

  const possibleDeclineSignals = [];
  if (memoryTrend <= -8) possibleDeclineSignals.push("Memory trend declined versus baseline.");
  if (speechTrend <= -8) possibleDeclineSignals.push("Speech recall trend declined versus baseline.");
  if (cognitiveTrend <= -10) possibleDeclineSignals.push("Composite cognitive trend shows downward movement.");
  if (!possibleDeclineSignals.length) {
    possibleDeclineSignals.push("No strong decline signal detected in available trend window.");
  }

  const contributingFactors = [];
  if (toNumber(contract.metrics.drawing.pending_sessions, 0) > 0) {
    contributingFactors.push("Some drawing sessions are still pending scoring.");
  }
  if (contract.metrics.session_quality_distribution.limited > 0) {
    contributingFactors.push("One or more sessions had limited signal quality.");
  }
  if (!contributingFactors.length) {
    contributingFactors.push("Signals are relatively stable across the captured sessions.");
  }

  const dataQualityNotes =
    contract.data_quality.notes.length > 0
      ? contract.data_quality.notes
      : ["Data quality appears sufficient for a monitoring-only summary."];

  return {
    clinical_summary:
      "Monitoring-only summary generated from structured metrics due to AI response fallback. Review trends alongside clinical context.",
    possible_decline_signals: possibleDeclineSignals,
    contributing_factors: contributingFactors,
    data_quality_notes: [...dataQualityNotes, `Fallback reason: ${reason}`],
    recommended_followup_questions: [
      "Have there been any recent changes in sleep, stress, or daily routine?",
      "Were there technical issues during the latest assessment session?",
      "Would repeating the assessment in a controlled setting help verify trend changes?",
    ],
    confidence: 0.35,
  };
};

const buildPrompt = (contract) => {
  return [
    "You are a clinical monitoring assistant for doctors.",
    "Return strict JSON only with no markdown fences and no additional keys.",
    "Use monitoring-only language. Do not provide diagnosis, treatment plans, or medication advice.",
    "Output schema:",
    "{",
    '  "clinical_summary": "string",',
    '  "possible_decline_signals": ["string"],',
    '  "contributing_factors": ["string"],',
    '  "data_quality_notes": ["string"],',
    '  "recommended_followup_questions": ["string"],',
    '  "confidence": 0.0',
    "}",
    "Confidence must be between 0 and 1.",
    "Input contract JSON:",
    asJsonString(contract),
  ].join("\n");
};

const extractMessageText = (content) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        if (typeof part.text === "string") return part.text;
        if (typeof part.content === "string") return part.content;
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
};

const parseJsonObject = (rawText) => {
  const normalized = String(rawText || "").trim();
  if (!normalized) {
    throw new Error("AI response was empty.");
  }

  const withoutFence = normalized
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const first = withoutFence.indexOf("{");
    const last = withoutFence.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
      throw new Error("AI response did not contain a valid JSON object.");
    }
    return JSON.parse(withoutFence.slice(first, last + 1));
  }
};

const validateReport = (raw) => {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI response JSON was not an object.");
  }

  const clinicalSummary = String(
    raw.clinical_summary ?? raw.clinicalSummary ?? "",
  ).trim();
  if (!clinicalSummary) {
    throw new Error("AI response missing clinical_summary.");
  }

  return {
    clinical_summary: clinicalSummary,
    possible_decline_signals: toStringArray(
      raw.possible_decline_signals ?? raw.possibleDeclineSignals,
    ),
    contributing_factors: toStringArray(raw.contributing_factors ?? raw.contributingFactors),
    data_quality_notes: toStringArray(raw.data_quality_notes ?? raw.dataQualityNotes),
    recommended_followup_questions: toStringArray(
      raw.recommended_followup_questions ?? raw.recommendedFollowupQuestions,
    ),
    confidence: round(clamp(toNumber(raw.confidence, 0.35), 0, 1), 3),
  };
};

const withTimeout = async (task, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

const callBackboard = async ({ prompt }) => {
  if (!config.backboardEnabled || !config.backboardApiKey) {
    throw new Error("Backboard is disabled or BACKBOARD_API_KEY is not configured.");
  }

  return withTimeout(async (signal) => {
    const response = await fetch(config.backboardApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.backboardApiKey}`,
      },
      body: JSON.stringify({
        model: config.backboardModel,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "Return strict JSON only. Monitoring-only language. No diagnosis or treatment instructions.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(
        `Backboard request failed (${response.status}): ${sanitizeError(bodyText).slice(0, 180)}`,
      );
    }

    const payload = await response.json();
    const message = payload?.choices?.[0]?.message;
    const contentText = extractMessageText(message?.content);
    const parsed = parseJsonObject(contentText);
    const report = validateReport(parsed);

    return {
      report,
      source: "backboard",
      model: String(payload?.model || config.backboardModel),
    };
  }, config.deepAnalysisTimeoutMs);
};

const callGeminiDirect = async ({ prompt }) => {
  if (!config.geminiEnabled || !config.geminiApiKey) {
    throw new Error("Gemini fallback is disabled or GEMINI_API_KEY is not configured.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

  return withTimeout(async (signal) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
      signal,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(
        `Gemini request failed (${response.status}): ${sanitizeError(bodyText).slice(0, 180)}`,
      );
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => String(part?.text || ""))
      .join("\n");

    const parsed = parseJsonObject(text);
    const report = validateReport(parsed);
    return {
      report,
      source: "gemini",
      model: config.geminiModel,
    };
  }, config.deepAnalysisTimeoutMs);
};

const runAiRequestWithRetry = async ({ prompt }) => {
  let lastError = null;

  for (let attempt = 0; attempt <= config.deepAnalysisMaxRetries; attempt += 1) {
    try {
      return await callBackboard({ prompt });
    } catch (error) {
      lastError = error;
      if (attempt < config.deepAnalysisMaxRetries) {
        await sleep(400 * (attempt + 1));
      }
    }
  }

  if (config.geminiEnabled && config.geminiApiKey) {
    try {
      return await callGeminiDirect({ prompt });
    } catch (error) {
      lastError = error;
    }
  }

  throw (lastError || new Error("AI request failed with unknown error."));
};

const persistDeepAnalysis = async ({
  patientId,
  assessmentCount,
  source,
  model,
  status,
  error,
  report,
}) => {
  const result = await query(
    `
      INSERT INTO doctor_deep_analysis_reports (
        patient_id,
        assessment_count,
        source,
        model,
        status,
        error,
        report_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING
        id,
        patient_id,
        assessment_count,
        generated_at,
        source,
        model,
        status,
        error,
        report_json
    `,
    [
      String(patientId),
      Math.max(0, Number(assessmentCount) || 0),
      String(source || "fallback"),
      model ? String(model) : null,
      String(status || "error"),
      error ? sanitizeError(error) : null,
      JSON.stringify(report),
    ],
  );

  return result.rows[0];
};

const mapStoredReport = (row) => {
  return {
    id: Number(row.id),
    patientId: String(row.patient_id),
    assessmentCount: toNumber(row.assessment_count, 0),
    generatedAt: toIsoOrNull(row.generated_at),
    source: String(row.source || "fallback"),
    model: row.model ? String(row.model) : null,
    status: String(row.status || "error"),
    error: row.error ? String(row.error) : null,
    report: validateReport(row.report_json),
  };
};

export const getLatestDeepAnalysisForPatient = async (patientId) => {
  const normalizedPatientId = String(patientId || "").trim();
  if (!normalizedPatientId) return null;

  const result = await query(
    `
      SELECT
        id,
        patient_id,
        assessment_count,
        generated_at,
        source,
        model,
        status,
        error,
        report_json
      FROM doctor_deep_analysis_reports
      WHERE patient_id = $1
      ORDER BY generated_at DESC
      LIMIT 1
    `,
    [normalizedPatientId],
  );

  if (!result.rows.length) return null;

  try {
    return mapStoredReport(result.rows[0]);
  } catch {
    return null;
  }
};

export async function runDeepAnalysisForPatient(patientId) {
  const rows = await getAssessmentMetricsRows(patientId, MAX_PATIENT_ASSESSMENTS);
  if (!rows.length) {
    const error = new Error("No assessments found for the selected patient.");
    error.status = 404;
    throw error;
  }

  const { contract } = buildDeepAnalysisContract(rows, patientId);
  const prompt = buildPrompt(contract);

  let finalStatus = "success";
  let source = "backboard";
  let model = config.backboardModel;
  let report = null;
  let errorMessage = null;

  try {
    const aiResponse = await runAiRequestWithRetry({ prompt });
    report = aiResponse.report;
    source = aiResponse.source;
    model = aiResponse.model;
  } catch (error) {
    finalStatus = "fallback";
    source = "fallback";
    model = null;
    errorMessage = safeErrorMessage(error);
    report = buildFallbackReport({
      contract,
      reason: sanitizeError(errorMessage),
    });
  }

  const storedRow = await persistDeepAnalysis({
    patientId,
    assessmentCount: rows.length,
    source,
    model,
    status: finalStatus,
    error: errorMessage,
    report,
  });

  return mapStoredReport(storedRow);
}
