import { query } from "./db.js";

const MAX_ASSESSMENTS = 5000;

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const averageDefined = (values) => {
  const defined = values.filter((value) => Number.isFinite(value));
  if (!defined.length) return 0;
  return average(defined);
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const formatTrendLabel = (isoDate, fallbackLabel) => {
  const parsed = new Date(String(isoDate || ""));
  if (Number.isNaN(parsed.getTime())) return fallbackLabel;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const buildPatientCode = (auth0UserId, index) => {
  const compact = String(auth0UserId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  const suffix = compact.slice(-4) || String(index + 1).padStart(4, "0");
  return `PT-${suffix.padStart(4, "0")}`;
};

const toSessionQualityScore = (sessionQuality) => {
  if (sessionQuality === "good") return 84;
  if (sessionQuality === "limited") return 62;
  return 50;
};

const toPercent = (ratio, digits = 1) => round(clamp(toNumber(ratio, 0), 0, 1) * 100, digits);

const readSignalAverage = (value) => {
  if (!value || typeof value !== "object") return null;

  const asRecord = value;
  const avg = toNumber(asRecord.avg, Number.NaN);
  if (Number.isFinite(avg)) return round(avg, 3);

  const averageValue = toNumber(asRecord.average, Number.NaN);
  if (Number.isFinite(averageValue)) return round(averageValue, 3);

  return null;
};

const readPersistedAiReport = (payload) => {
  const report = payload?.aiReport;
  if (!report || typeof report !== "object") return null;

  const clinicalSummary =
    typeof report.clinicalSummary === "string" ? report.clinicalSummary.trim() : "";
  if (!clinicalSummary) return null;

  const confidence = clamp(toNumber(report.confidence, 0), 0, 1);
  const drawingQualityScoreRaw = toNumber(report.drawingQualityScore, Number.NaN);
  const drawingQualityScore = Number.isFinite(drawingQualityScoreRaw)
    ? round(clamp(drawingQualityScoreRaw, 0, 100), 1)
    : null;
  const drawingQualityNotes =
    typeof report.drawingQualityNotes === "string" && report.drawingQualityNotes.trim()
      ? report.drawingQualityNotes.trim()
      : null;

  return {
    clinicalSummary,
    confidence: round(confidence, 3),
    source:
      typeof report.source === "string" && report.source.trim()
        ? report.source.trim()
        : "unknown",
    error:
      typeof report.error === "string" && report.error.trim()
        ? report.error.trim()
        : null,
    possibleDeclineSignals: Array.isArray(report.possibleDeclineSignals)
      ? report.possibleDeclineSignals.map((item) => String(item)).filter(Boolean)
      : [],
    contributingFactors: Array.isArray(report.contributingFactors)
      ? report.contributingFactors.map((item) => String(item)).filter(Boolean)
      : [],
    drawingQualityScore,
    drawingQualityNotes,
  };
};

const computeRecallRatio = (row) => {
  const maxScore = toNumber(row.memory_recall_max, 0);
  const score = toNumber(row.memory_recall_score, 0);
  const accuracy = toNumber(row.memory_recall_accuracy, 0);

  if (maxScore > 0) return clamp(score / maxScore, 0, 1);
  if (accuracy > 0) return clamp(accuracy, 0, 1);
  return 0;
};

const computeMemoryChallengeRatio = (row) => {
  const part1Total = toNumber(row.memory_challenge_part1_total, 0);
  const part1Correct = toNumber(row.memory_challenge_part1_correct, 0);
  const part3Total = toNumber(row.memory_challenge_part3_total, 0);
  const part3Correct = toNumber(row.memory_challenge_part3_correct, 0);

  const ratios = [];
  if (part1Total > 0) ratios.push(clamp(part1Correct / part1Total, 0, 1));
  if (part3Total > 0) ratios.push(clamp(part3Correct / part3Total, 0, 1));

  if (!ratios.length) return null;
  return average(ratios);
};

const computeSpeechRatio = (row) => {
  const recallAccuracy = toNumber(row.speech_recall_accuracy, 0);
  if (recallAccuracy > 0) return clamp(recallAccuracy, 0, 1);

  const totalTargetWords = toNumber(row.speech_total_target_words, 0);
  const matchedWords = toNumber(row.speech_matched_count, 0);
  if (totalTargetWords > 0) return clamp(matchedWords / totalTargetWords, 0, 1);

  const wordCount = toNumber(row.speech_word_count, 0);
  const speechRateWpm = toNumber(row.speech_rate_wpm, 0);
  const vocab = clamp(toNumber(row.speech_vocabulary_diversity, 0), 0, 1);

  const wordComponent = clamp(wordCount / 25, 0, 1);
  const paceComponent = clamp(speechRateWpm / 120, 0, 1);
  return clamp(wordComponent * 0.55 + paceComponent * 0.25 + vocab * 0.2, 0, 1);
};

const buildContributingSignals = (trendRows) => {
  if (!trendRows.length) return [];

  const latest = trendRows[trendRows.length - 1];
  const baselineCandidates = trendRows.slice(-5, -1);
  const baseline = baselineCandidates.length ? baselineCandidates : trendRows.slice(0, -1);

  const metricMeta = [
    { key: "memoryRatio", label: "memory recall" },
    { key: "speechRatio", label: "speech fluency" },
    { key: "memoryChallengeRatio", label: "memory challenge" },
    { key: "cognitiveScore", label: "cognitive score" },
  ];

  return metricMeta
    .map(({ key, label }) => {
      const latestValue = toNumber(latest[key], 0);
      const baselineValue = averageDefined(baseline.map((row) => toNumber(row[key], 0)));
      const delta = latestValue - baselineValue;
      const absDelta = Math.abs(delta);
      const direction = absDelta < 0.01 ? "stable" : delta > 0 ? "up" : "down";
      const confidence = round(clamp(0.45 + absDelta * 2.5, 0.45, 0.95), 2);
      return {
        signal: label,
        direction,
        delta: round(delta, 3),
        confidence,
        note:
          direction === "stable"
            ? `${label} remained near baseline over recent sessions.`
            : `${label} moved ${direction} compared to recent baseline.`,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);
};

const deriveRisk = ({ memoryScore, speechScore, cognitiveDelta }) => {
  if (memoryScore < 45 || speechScore < 45 || cognitiveDelta <= -12) return "High";
  if (memoryScore < 70 || speechScore < 65 || cognitiveDelta <= -5) return "Moderate";
  return "Low";
};

const buildSummaryText = ({ risk, contributingSignals }) => {
  if (!contributingSignals.length) {
    return "Monitoring-only summary: insufficient historical points to estimate trend direction.";
  }

  const topSignal = contributingSignals[0];
  if (risk === "High") {
    return `Monitoring-only summary: multiple declines observed, led by ${topSignal.signal}. Recommend timely clinical review.`;
  }
  if (topSignal.direction === "stable") {
    return "Monitoring-only summary: key signals are stable versus baseline.";
  }
  return `Monitoring-only summary: notable ${topSignal.direction} shift in ${topSignal.signal} versus baseline.`;
};

const toActivityNote = ({ recallScore, speechScore, sessionQuality, drawingCompletion }) => {
  return `Assessment captured (Recall ${recallScore}, Speech ${speechScore}, Drawing ${drawingCompletion}%, Session ${sessionQuality}).`;
};

const hasMetricData = ({ score, total, accuracy, extra = [] }) => {
  if (toNumber(total, 0) > 0) return true;
  if (toNumber(score, 0) > 0) return true;
  if (toNumber(accuracy, 0) > 0) return true;
  return extra.some((value) => toNumber(value, 0) > 0);
};

const extractBase64Length = (value) => {
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const commaIndex = trimmed.indexOf(",");
  if (commaIndex < 0) return trimmed.length;
  return Math.max(0, trimmed.length - commaIndex - 1);
};

const estimateDrawingScoreFromDataUrls = (drawing) => {
  if (!drawing || typeof drawing !== "object") return null;
  const completedTasks = toNumber(drawing.completedTasks, 0);
  const totalTasks = toNumber(drawing.totalTasks, 0);
  const completionRatio =
    totalTasks > 0 ? clamp(completedTasks / totalTasks, 0, 1) : 0;

  const imageLengths = [
    extractBase64Length(drawing.step1ImageDataUrl),
    extractBase64Length(drawing.step2ImageDataUrl),
    extractBase64Length(drawing.step3ImageDataUrl),
  ].filter((value) => value > 0);

  if (!imageLengths.length) return null;

  const averageLength = average(imageLengths);
  const complexity = clamp((averageLength - 4000) / (120000 - 4000), 0, 1);
  const score = clamp(completionRatio * 0.4 + complexity * 0.6, 0, 1) * 100;
  return round(score, 1);
};

const mapRowToMetrics = (row, trendIndex) => {
  const capturedAt = toIsoOrNull(row.captured_at);
  const submittedAt = toIsoOrNull(row.submitted_at);

  const memoryRecallScore = toNumber(row.memory_recall_score, 0);
  const memoryRecallMax = toNumber(row.memory_recall_max, 0);
  const memoryRecallAccuracyRatio =
    memoryRecallMax > 0
      ? clamp(memoryRecallScore / memoryRecallMax, 0, 1)
      : clamp(toNumber(row.memory_recall_accuracy, 0), 0, 1);

  const memoryChallengePart1Correct = toNumber(row.memory_challenge_part1_correct, 0);
  const memoryChallengePart1Total = toNumber(row.memory_challenge_part1_total, 0);
  const memoryChallengePart3Correct = toNumber(row.memory_challenge_part3_correct, 0);
  const memoryChallengePart3Total = toNumber(row.memory_challenge_part3_total, 0);

  const memoryChallengePart1Accuracy =
    memoryChallengePart1Total > 0
      ? clamp(memoryChallengePart1Correct / memoryChallengePart1Total, 0, 1)
      : null;
  const memoryChallengePart3Accuracy =
    memoryChallengePart3Total > 0
      ? clamp(memoryChallengePart3Correct / memoryChallengePart3Total, 0, 1)
      : null;

  const drawingCompleted = toNumber(row.drawing_completed_tasks, 0);
  const drawingTotal = toNumber(row.drawing_total_tasks, 0);
  const drawingCompletionRatio =
    drawingTotal > 0
      ? clamp(drawingCompleted / drawingTotal, 0, 1)
      : clamp(toNumber(row.drawing_completion_ratio, 0), 0, 1);

  const speechWordCount = toNumber(row.speech_word_count, 0);
  const speechRateWpm = toNumber(row.speech_rate_wpm, 0);
  const speechVocabularyDiversity = clamp(toNumber(row.speech_vocabulary_diversity, 0), 0, 1);
  const speechMatchedCount = toNumber(row.speech_matched_count, 0);
  const speechTotalTarget = toNumber(row.speech_total_target_words, 0);
  const speechRecallAccuracy =
    speechTotalTarget > 0
      ? clamp(speechMatchedCount / speechTotalTarget, 0, 1)
      : clamp(toNumber(row.speech_recall_accuracy, 0), 0, 1);

  const recallRatio = computeRecallRatio(row);
  const memoryChallengeRatio = computeMemoryChallengeRatio(row);
  const memoryRatio = clamp(
    averageDefined([recallRatio, memoryChallengeRatio ?? recallRatio]),
    0,
    1,
  );
  const speechRatio = computeSpeechRatio(row);
  const cognitiveScore = round((memoryRatio * 0.7 + speechRatio * 0.3) * 100, 1);

  const sessionQuality = String(row.session_quality || "unavailable");
  const facialSignalsStatus = String(row.facial_signals_status || "unknown");
  const aiReport = readPersistedAiReport(row.attempt_payload);
  const payloadDrawings = row?.attempt_payload?.tests?.test1?.drawings || {};
  const step1ImageDataUrl =
    typeof row.test1_step1_image_data_url === "string"
      ? row.test1_step1_image_data_url
      : typeof payloadDrawings.step1 === "string"
        ? payloadDrawings.step1
        : null;
  const step2ImageDataUrl =
    typeof row.test1_step2_image_data_url === "string"
      ? row.test1_step2_image_data_url
      : typeof payloadDrawings.step2 === "string"
        ? payloadDrawings.step2
        : null;
  const step3ImageDataUrl =
    typeof row.test1_step3_image_data_url === "string"
      ? row.test1_step3_image_data_url
      : typeof payloadDrawings.step3 === "string"
        ? payloadDrawings.step3
        : null;
  const normalizedStep1ImageDataUrl =
    typeof step1ImageDataUrl === "string" && step1ImageDataUrl.trim() ? step1ImageDataUrl.trim() : null;
  const normalizedStep2ImageDataUrl =
    typeof step2ImageDataUrl === "string" && step2ImageDataUrl.trim() ? step2ImageDataUrl.trim() : null;
  const normalizedStep3ImageDataUrl =
    typeof step3ImageDataUrl === "string" && step3ImageDataUrl.trim() ? step3ImageDataUrl.trim() : null;

  return {
    assessmentId: toNumber(row.assessment_id, trendIndex + 1),
    capturedAt: capturedAt || new Date().toISOString(),
    submittedAt,
    label: formatTrendLabel(capturedAt || row.captured_at, `S${trendIndex + 1}`),
    memoryRatio,
    speechRatio,
    memoryChallengeRatio: memoryChallengeRatio ?? recallRatio,
    cognitiveScore,
    speechScore: round(speechRatio * 100, 1),
    memoryScore: round(memoryRatio * 100, 1),
    recallRatio,
    drawingCompletionRatio,
    sessionQuality,
    facialSignalsStatus,
    availability: {
      memoryRecall: hasMetricData({ score: memoryRecallScore, total: memoryRecallMax, accuracy: memoryRecallAccuracyRatio }),
      memoryChallenge:
        memoryChallengePart1Total > 0 ||
        memoryChallengePart3Total > 0 ||
        memoryChallengePart1Correct > 0 ||
        memoryChallengePart3Correct > 0,
      drawing: drawingTotal > 0 || drawingCompleted > 0,
      speech:
        toNumber(row.speech_skipped ? 1 : 0, 0) > 0 ||
        hasMetricData({
          score: speechMatchedCount,
          total: speechTotalTarget,
          accuracy: speechRecallAccuracy,
          extra: [speechWordCount, speechRateWpm],
        }),
      facial:
        facialSignalsStatus !== "unknown" ||
        sessionQuality !== "unavailable" ||
        toNumber(row.facial_sample_count, 0) > 0 ||
        toNumber(row.facial_face_missing_events, 0) > 0,
    },
    timing: {
      assessmentStartedAt: toIsoOrNull(row.assessment_started_at),
      assessmentEndedAt: toIsoOrNull(row.assessment_ended_at),
      totalDurationSeconds: round(toNumber(row.assessment_total_duration_seconds, 0), 2),
    },
    memoryRecall: {
      score: memoryRecallScore,
      maxScore: memoryRecallMax,
      accuracyPercent: toPercent(memoryRecallAccuracyRatio, 1),
      durationSeconds: round(toNumber(row.memory_recall_duration_seconds, 0), 2),
    },
    memoryChallenge: {
      part1Correct: memoryChallengePart1Correct,
      part1Total: memoryChallengePart1Total,
      part1AccuracyPercent: memoryChallengePart1Accuracy !== null ? toPercent(memoryChallengePart1Accuracy, 1) : 0,
      part3Correct: memoryChallengePart3Correct,
      part3Total: memoryChallengePart3Total,
      part3AccuracyPercent: memoryChallengePart3Accuracy !== null ? toPercent(memoryChallengePart3Accuracy, 1) : 0,
      durationSeconds: round(toNumber(row.memory_challenge_duration_seconds, 0), 2),
    },
    drawing: {
      completedTasks: drawingCompleted,
      totalTasks: drawingTotal,
      completionPercent: toPercent(drawingCompletionRatio, 1),
      durationSeconds: round(toNumber(row.drawing_duration_seconds, 0), 2),
      step1ImageDataUrl: normalizedStep1ImageDataUrl,
      step2ImageDataUrl: normalizedStep2ImageDataUrl,
      step3ImageDataUrl: normalizedStep3ImageDataUrl,
    },
    speech: {
      wordCount: speechWordCount,
      speechRateWpm: round(speechRateWpm, 1),
      vocabularyDiversityPercent: toPercent(speechVocabularyDiversity, 1),
      recallAccuracyPercent: toPercent(speechRecallAccuracy, 1),
      matchedCount: speechMatchedCount,
      totalTargetWords: speechTotalTarget,
      durationSeconds: round(toNumber(row.speech_duration_seconds, 0), 2),
      phase: String(row.speech_phase || "listen"),
      micPermission: String(row.speech_mic_permission || "unknown"),
      skipped: Boolean(row.speech_skipped),
      listenPlayedAt: toIsoOrNull(row.speech_listen_played_at),
      repeatStartedAt: toIsoOrNull(row.speech_repeat_started_at),
      repeatEndedAt: toIsoOrNull(row.speech_repeat_ended_at),
    },
    facial: {
      status: facialSignalsStatus,
      sessionQuality,
      source: String(row.facial_source || "unavailable"),
      faceMissingEvents: toNumber(row.facial_face_missing_events, 0),
      faceMissingSeconds: round(toNumber(row.facial_face_missing_seconds, 0), 2),
      sampleCount: toNumber(row.facial_sample_count, 0),
      startedAt: toIsoOrNull(row.facial_started_at),
      endedAt: toIsoOrNull(row.facial_ended_at),
      engagementAvg: readSignalAverage(row.facial_engagement_json),
      blinkRateAvg: readSignalAverage(row.facial_blink_rate_json),
      expressionVariabilityAvg: readSignalAverage(row.facial_expression_variability_json),
      facePresenceAvg: readSignalAverage(row.facial_face_presence_json),
    },
    aiReport,
  };
};

const buildEmptyDashboard = () => ({
  generatedAt: new Date().toISOString(),
  kpis: {
    totalPatients: 0,
    totalAssessments: 0,
    newAssessments: 0,
    highRiskPatients: 0,
    avgCognitiveTrendDelta: 0,
    avgSessionDurationSeconds: 0,
    limitedSignalSessions: 0,
    unavailableSignalSessions: 0,
  },
  patients: [],
  priorityQueue: [],
  activities: [],
});

const rowsToDashboard = (rows) => {
  if (!rows.length) return buildEmptyDashboard();

  const groupedByPatient = new Map();

  rows.forEach((row) => {
    const key = String(row.patient_user_id || row.patient_sub || "unknown-patient");
    if (!groupedByPatient.has(key)) {
      groupedByPatient.set(key, []);
    }
    groupedByPatient.get(key).push(row);
  });

  const patients = [];
  const allActivities = [];

  [...groupedByPatient.entries()].forEach(([patientKey, patientRows], index) => {
    const sortedRows = [...patientRows].sort(
      (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
    );

    const detailRows = sortedRows.map((row, trendIndex) => mapRowToMetrics(row, trendIndex));
    const trendRows = detailRows.map((row) => ({
      assessmentId: row.assessmentId,
      capturedAt: row.capturedAt,
      label: row.label,
      recallRatio: row.recallRatio,
      memoryChallengeRatio: row.memoryChallengeRatio,
      memoryRatio: row.memoryRatio,
      speechRatio: row.speechRatio,
      cognitiveScore: row.cognitiveScore,
      speechScore: row.speechScore,
      memoryScore: row.memoryScore,
      sessionQuality: row.sessionQuality,
      drawingCompletionRatio: row.drawingCompletionRatio,
    }));

    const latest = trendRows[trendRows.length - 1];
    const first = trendRows[0];
    const latestDetail = detailRows[detailRows.length - 1];

    const cognitiveDelta = round(latest.cognitiveScore - first.cognitiveScore, 1);
    const risk = deriveRisk({
      memoryScore: latest.memoryScore,
      speechScore: latest.speechScore,
      cognitiveDelta,
    });

    const patientName =
      String(sortedRows[sortedRows.length - 1]?.patient_name || "").trim() || "Unknown Patient";
    const patientEmail =
      String(sortedRows[sortedRows.length - 1]?.patient_email || "").trim() || "";

    const patientCode = buildPatientCode(
      sortedRows[sortedRows.length - 1]?.auth0_user_id || sortedRows[0]?.patient_sub || "",
      index,
    );

    const contributingSignals = buildContributingSignals(trendRows);

    const patientActivities = detailRows.slice(-3).map((row) => ({
      id: `assessment-${row.assessmentId}`,
      patientId: patientKey,
      patientName,
      at: row.capturedAt,
      note: toActivityNote({
        recallScore: round(row.memoryScore, 0),
        speechScore: round(row.speechScore, 0),
        drawingCompletion: row.drawing.completionPercent,
        sessionQuality: row.sessionQuality,
      }),
      type: "assessment",
    }));

    const latestSessionQuality = latest.sessionQuality;
    if (latestSessionQuality !== "good") {
      patientActivities.push({
        id: `flag-${patientKey}-${latest.assessmentId}`,
        patientId: patientKey,
        patientName,
        at: latest.capturedAt,
        note:
          latestSessionQuality === "limited"
            ? "Session quality was limited; consider confirming test conditions."
            : "Session quality unavailable; review with context before interpretation.",
        type: "flag",
      });
    }
    if (risk === "High") {
      patientActivities.push({
        id: `review-${patientKey}-${latest.assessmentId}`,
        patientId: patientKey,
        patientName,
        at: latest.capturedAt,
        note: "High-risk trend profile detected. Clinical review is recommended.",
        type: "follow-up",
      });
    }

    allActivities.push(...patientActivities);

    const coverage = detailRows.reduce(
      (acc, row) => {
        if (row.availability.memoryRecall) acc.memoryRecall += 1;
        if (row.availability.drawing) acc.drawing += 1;
        if (row.availability.memoryChallenge) acc.memoryChallenge += 1;
        if (row.availability.speech) acc.speech += 1;
        if (row.availability.facial) acc.facial += 1;
        return acc;
      },
      { memoryRecall: 0, drawing: 0, memoryChallenge: 0, speech: 0, facial: 0 },
    );

    const latestConfidence = round(
      average(contributingSignals.map((signal) => toNumber(signal.confidence, 0.6))),
      2,
    );
    const persistedAiReport = latestDetail.aiReport;
    const fallbackDrawingScore = estimateDrawingScoreFromDataUrls(latestDetail?.drawing);
    const fallbackDrawingNotes =
      fallbackDrawingScore === null
        ? "Drawing quality score is unavailable until Gemini image scoring succeeds."
        : "Drawing quality score is estimated from drawing stroke density and completion while Gemini is unavailable.";

    patients.push({
      id: patientKey,
      name: patientName,
      email: patientEmail,
      code: patientCode,
      risk,
      assessedAt: latest.capturedAt,
      firstAssessedAt: detailRows[0].capturedAt,
      assessmentCount: detailRows.length,
      recallScore: round(latest.recallRatio * 100, 0),
      speechScore: round(latest.speechScore, 0),
      memoryScore: round(latest.memoryScore, 0),
      engagementScore: toSessionQualityScore(latestSessionQuality),
      summary:
        persistedAiReport?.clinicalSummary ||
        buildSummaryText({ risk, contributingSignals }),
      contributingSignals,
      trends: trendRows.map((row) => ({
        label: row.label,
        capturedAt: row.capturedAt,
        cognitive: row.cognitiveScore,
        speech: row.speechScore,
        memory: row.memoryScore,
      })),
      activities: patientActivities,
      sessionQuality: latestSessionQuality,
      latestSummaryConfidence: persistedAiReport?.confidence ?? latestConfidence,
      summarySource: persistedAiReport?.source || "heuristic",
      summaryError: persistedAiReport?.error || null,
      possibleDeclineSignals: persistedAiReport?.possibleDeclineSignals || [],
      contributingFactors: persistedAiReport?.contributingFactors || [],
      drawingQualityScore:
        typeof persistedAiReport?.drawingQualityScore === "number"
          ? persistedAiReport.drawingQualityScore
          : fallbackDrawingScore,
      drawingQualityNotes: persistedAiReport?.drawingQualityNotes || fallbackDrawingNotes,
      latestAssessment: {
        assessmentId: latestDetail.assessmentId,
        capturedAt: latestDetail.capturedAt,
        submittedAt: latestDetail.submittedAt,
        timing: latestDetail.timing,
        memoryRecall: latestDetail.memoryRecall,
        memoryChallenge: latestDetail.memoryChallenge,
        drawing: latestDetail.drawing,
        speech: latestDetail.speech,
        facial: latestDetail.facial,
      },
      aggregates: {
        avgRecallAccuracyPercent: round(
          averageDefined(detailRows.map((row) => row.memoryRecall.accuracyPercent)),
          1,
        ),
        avgDrawingCompletionPercent: round(
          averageDefined(detailRows.map((row) => row.drawing.completionPercent)),
          1,
        ),
        avgSpeechWordCount: round(
          averageDefined(detailRows.map((row) => row.speech.wordCount)),
          1,
        ),
        avgSpeechRateWpm: round(
          averageDefined(detailRows.map((row) => row.speech.speechRateWpm)),
          1,
        ),
        avgVocabularyDiversityPercent: round(
          averageDefined(detailRows.map((row) => row.speech.vocabularyDiversityPercent)),
          1,
        ),
        avgSessionDurationSeconds: round(
          averageDefined(detailRows.map((row) => row.timing.totalDurationSeconds)),
          1,
        ),
        avgFaceMissingSeconds: round(
          averageDefined(detailRows.map((row) => row.facial.faceMissingSeconds)),
          1,
        ),
      },
      dataCoverage: coverage,
    });
  });

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newAssessments = rows.filter(
    (row) => new Date(row.captured_at).getTime() >= oneWeekAgo,
  ).length;

  const highRiskPatients = patients.filter((patient) => patient.risk === "High").length;

  const avgCognitiveTrendDelta = round(
    average(
      patients.map((patient) => {
        if (patient.trends.length < 2) return 0;
        return (
          toNumber(patient.trends[patient.trends.length - 1].cognitive, 0) -
          toNumber(patient.trends[0].cognitive, 0)
        );
      }),
    ),
    1,
  );

  const avgSessionDurationSeconds = round(
    averageDefined(rows.map((row) => toNumber(row.assessment_total_duration_seconds, 0))),
    1,
  );

  const limitedSignalSessions = rows.filter(
    (row) => String(row.session_quality || "unavailable") === "limited",
  ).length;

  const unavailableSignalSessions = rows.filter(
    (row) => String(row.session_quality || "unavailable") === "unavailable",
  ).length;

  const priorityQueue = patients
    .map((patient) => {
      const first = patient.trends[0];
      const latest = patient.trends[patient.trends.length - 1];
      return {
        patientId: patient.id,
        name: patient.name,
        code: patient.code,
        risk: patient.risk,
        cognitiveDelta: round(
          toNumber(latest?.cognitive, 0) - toNumber(first?.cognitive, 0),
          1,
        ),
      };
    })
    .filter((item) => item.risk === "High" || item.cognitiveDelta <= -8)
    .sort((a, b) => {
      const riskWeight = { Low: 1, Moderate: 2, High: 3 };
      return riskWeight[b.risk] - riskWeight[a.risk];
    })
    .slice(0, 12);

  const activities = allActivities
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      totalPatients: patients.length,
      totalAssessments: rows.length,
      newAssessments,
      highRiskPatients,
      avgCognitiveTrendDelta,
      avgSessionDurationSeconds,
      limitedSignalSessions,
      unavailableSignalSessions,
    },
    patients: patients.sort(
      (a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime(),
    ),
    priorityQueue,
    activities,
  };
};

export async function getDoctorDashboardData() {
  const rowsResult = await query(
    `
      SELECT
        a.id AS assessment_id,
        a.patient_user_id,
        a.patient_sub,
        a.captured_at,
        a.submitted_at,
        a.assessment_started_at,
        a.assessment_ended_at,
        COALESCE(a.total_duration_seconds, 0) AS assessment_total_duration_seconds,
        a.attempt_payload AS attempt_payload,
        COALESCE(u.auth0_user_id, a.patient_sub) AS auth0_user_id,
        COALESCE(u.full_name, u.email, a.patient_sub, 'Unknown Patient') AS patient_name,
        COALESCE(u.email, a.patient_email, '') AS patient_email,

        COALESCE(mr.score, 0) AS memory_recall_score,
        COALESCE(mr.max_score, 0) AS memory_recall_max,
        COALESCE(mr.accuracy, 0) AS memory_recall_accuracy,
        COALESCE(mr.duration_seconds, 0) AS memory_recall_duration_seconds,

        COALESCE(mc.part1_correct_count, 0) AS memory_challenge_part1_correct,
        COALESCE(mc.part1_total_target, 0) AS memory_challenge_part1_total,
        COALESCE(mc.part3_correct_count, 0) AS memory_challenge_part3_correct,
        COALESCE(mc.part3_total_count, 0) AS memory_challenge_part3_total,
        COALESCE(mc.duration_seconds, 0) AS memory_challenge_duration_seconds,

        COALESCE(dr.completed_tasks, 0) AS drawing_completed_tasks,
        COALESCE(dr.total_tasks, 0) AS drawing_total_tasks,
        COALESCE(dr.completion_ratio, 0) AS drawing_completion_ratio,
        COALESCE(dr.duration_seconds, 0) AS drawing_duration_seconds,
        t1.step1_image_data_url AS test1_step1_image_data_url,
        t1.step2_image_data_url AS test1_step2_image_data_url,
        t1.step3_image_data_url AS test1_step3_image_data_url,

        COALESCE(sr.word_count, 0) AS speech_word_count,
        COALESCE(sr.speech_rate_wpm, 0) AS speech_rate_wpm,
        COALESCE(sr.vocabulary_diversity, 0) AS speech_vocabulary_diversity,
        COALESCE(sr.recall_accuracy, 0) AS speech_recall_accuracy,
        COALESCE(sr.matched_count, 0) AS speech_matched_count,
        COALESCE(sr.total_target_words, 0) AS speech_total_target_words,
        COALESCE(sr.duration_seconds, 0) AS speech_duration_seconds,
        COALESCE(sr.phase, 'listen') AS speech_phase,
        COALESCE(sr.mic_permission, 'unknown') AS speech_mic_permission,
        COALESCE(sr.skipped, false) AS speech_skipped,
        sr.listen_played_at AS speech_listen_played_at,
        sr.repeat_started_at AS speech_repeat_started_at,
        sr.repeat_ended_at AS speech_repeat_ended_at,

        COALESCE(fm.session_quality, 'unavailable') AS session_quality,
        COALESCE(fm.facial_signals_status, 'unknown') AS facial_signals_status,
        COALESCE(fm.source, 'unavailable') AS facial_source,
        COALESCE(fm.face_missing_events, 0) AS facial_face_missing_events,
        COALESCE(fm.face_missing_seconds, 0) AS facial_face_missing_seconds,
        COALESCE(fm.sample_count, 0) AS facial_sample_count,
        fm.started_at AS facial_started_at,
        fm.ended_at AS facial_ended_at,
        fm.engagement_json AS facial_engagement_json,
        fm.blink_rate_json AS facial_blink_rate_json,
        fm.expression_variability_json AS facial_expression_variability_json,
        fm.face_presence_json AS facial_face_presence_json
      FROM assessments a
      JOIN app_users u ON u.id = a.patient_user_id
      LEFT JOIN memory_recall_results mr ON mr.assessment_id = a.id
      LEFT JOIN memory_challenge_results mc ON mc.assessment_id = a.id
      LEFT JOIN drawing_results dr ON dr.assessment_id = a.id
      LEFT JOIN test1_drawing_results t1 ON t1.assessment_id = a.id
      LEFT JOIN speech_results sr ON sr.assessment_id = a.id
      LEFT JOIN facial_metrics fm ON fm.assessment_id = a.id
      ORDER BY a.captured_at ASC
      LIMIT $1
    `,
    [MAX_ASSESSMENTS],
  );

  return rowsToDashboard(rowsResult.rows);
}
