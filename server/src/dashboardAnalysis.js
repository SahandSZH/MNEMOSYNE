const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const round = (value, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const signalMapping = [
  { key: "engagement", label: "engagement" },
  { key: "blinkRate", label: "blink rate" },
  { key: "expressionVariability", label: "expression variability" },
  { key: "facePresence", label: "face presence" },
];

const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const toTrimmedText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const isDataUrlImage = (value) =>
  /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(toTrimmedText(value));

function getSignalAverage(attempt, signalKey) {
  return toNumber(attempt?.presage?.metrics?.[signalKey]?.avg, 0);
}

function buildContributingSignals(latestAttempt, history) {
  const baselineCandidates = history.slice(-4);
  const summary = signalMapping.map(({ key, label }) => {
    const latest = getSignalAverage(latestAttempt, key);
    const baseline = average(baselineCandidates.map((attempt) => getSignalAverage(attempt, key)));
    const delta = latest - baseline;
    const absDelta = Math.abs(delta);
    const direction = absDelta < 0.01 ? "stable" : delta > 0 ? "up" : "down";
    const confidence = round(Math.min(0.95, 0.45 + absDelta * 2), 2);
    return {
      signal: label,
      direction,
      delta: round(delta, 3),
      confidence,
      note:
        direction === "stable"
          ? `${label} remained stable compared to baseline.`
          : `${label} moved ${direction} relative to recent baseline.`,
    };
  });

  return summary.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function buildSummaryText(contributingSignals) {
  if (!contributingSignals.length) {
    return "Insufficient facial signal history for trend interpretation.";
  }

  const top = contributingSignals[0];
  if (top.direction === "stable") {
    return "Facial engagement profile remained largely stable in this session.";
  }
  return `Primary change observed in ${top.signal} (${top.direction}) compared to baseline trends.`;
}

function getPersistedAiReport(attempt) {
  const report = attempt?.aiReport;
  if (!report || typeof report !== "object") return null;

  const clinicalSummary =
    typeof report.clinicalSummary === "string" ? report.clinicalSummary.trim() : "";
  if (!clinicalSummary) return null;

  return {
    clinicalSummary,
    confidence: round(clamp(toNumber(report.confidence, 0), 0, 1), 3),
    source: typeof report.source === "string" ? report.source : "unknown",
    possibleDeclineSignals: Array.isArray(report.possibleDeclineSignals)
      ? report.possibleDeclineSignals.map((item) => String(item)).filter(Boolean)
      : [],
    contributingFactors: Array.isArray(report.contributingFactors)
      ? report.contributingFactors.map((item) => String(item)).filter(Boolean)
      : [],
    drawingQualityScore: clamp(toNumber(report.drawingQualityScore, 0), 0, 100),
    drawingQualityNotes:
      typeof report.drawingQualityNotes === "string" ? report.drawingQualityNotes : "",
    error: typeof report.error === "string" ? report.error : null,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function extractDrawingImageDataUrls(attempt) {
  const fromTests = attempt?.tests?.test1?.drawings || {};
  const fromLegacy = attempt?.testData?.test1Drawings || {};

  const step1 = toTrimmedText(fromTests?.step1 || fromLegacy?.[1] || fromLegacy?.step1);
  const step2 = toTrimmedText(fromTests?.step2 || fromLegacy?.[2] || fromLegacy?.step2);
  const step3 = toTrimmedText(fromTests?.step3 || fromLegacy?.[3] || fromLegacy?.step3);

  const entries = [
    { step: "step1", label: "clock drawing", dataUrl: step1 },
    { step: "step2", label: "conjoined pentagons copy", dataUrl: step2 },
    { step: "step3", label: "cube copy", dataUrl: step3 },
  ];

  return entries.map((entry) => ({
    ...entry,
    dataUrl: isDataUrlImage(entry.dataUrl) ? entry.dataUrl : null,
  }));
}

export function extractDrawingImagesForGemini(attempt) {
  return extractDrawingImageDataUrls(attempt).filter((entry) => Boolean(entry.dataUrl));
}

export function buildGeminiInputContract(latestAttempt, history) {
  const drawingImages = extractDrawingImageDataUrls(latestAttempt);
  const availableDrawingSteps = drawingImages.filter((entry) => entry.dataUrl).map((entry) => entry.step);

  return {
    memoryScore: latestAttempt.memoryRecall,
    drawingScore: latestAttempt.drawing,
    drawingContext: {
      clockTimePrompt:
        toTrimmedText(latestAttempt?.tests?.test1?.clockTimePrompt) ||
        toTrimmedText(latestAttempt?.drawing?.clockTimePrompt),
      availableDrawingSteps,
      completedTasks: toNumber(latestAttempt?.drawing?.completedTasks, 0),
      totalTasks: toNumber(latestAttempt?.drawing?.totalTasks, 0),
      completionRatio: toNumber(latestAttempt?.drawing?.completionRatio, 0),
    },
    speechMetrics: latestAttempt.speech,
    presageMetrics: latestAttempt.presage,
    historicalTrendData: history.map((attempt) => ({
      capturedAt: attempt.capturedAt,
      memoryRecall: attempt.memoryRecall,
      speech: attempt.speech,
      presage: attempt.presage,
    })),
  };
}

export function buildAiSummary(latestAttempt, history) {
  const contributingSignals = buildContributingSignals(latestAttempt, history);
  const summaryText = buildSummaryText(contributingSignals);
  const summaryConfidence = round(
    average(contributingSignals.map((signal) => signal.confidence)),
    2,
  );

  return {
    summaryText,
    summaryConfidence,
    contributingSignals,
  };
}

export function buildDoctorDashboardData(allAttempts) {
  const last12 = allAttempts.slice(-12);
  const facialEngagementTrend = last12.map((attempt, index) => ({
    label: `S${index + 1}`,
    value: getSignalAverage(attempt, "engagement"),
  }));

  const sessionQuality = allAttempts.reduce(
    (acc, attempt) => {
      const quality = attempt?.presage?.sessionQuality || "unavailable";
      if (quality === "good") acc.good += 1;
      else if (quality === "limited") acc.limited += 1;
      else acc.unavailable += 1;
      return acc;
    },
    { good: 0, limited: 0, unavailable: 0 },
  );

  const latestAttempt = allAttempts.at(-1);
  if (!latestAttempt) {
    return {
      facialEngagementTrend,
      sessionQuality,
      contributingSignals: [],
      latestSummary: "No assessment attempts yet.",
      latestSummaryConfidence: 0,
      geminiInputContract: null,
    };
  }

  const historyWithoutLatest = allAttempts.slice(0, -1);
  const aiSummary = buildAiSummary(latestAttempt, historyWithoutLatest);
  const persistedAiReport = getPersistedAiReport(latestAttempt);

  return {
    facialEngagementTrend,
    sessionQuality,
    contributingSignals: aiSummary.contributingSignals,
    latestSummary: persistedAiReport?.clinicalSummary || aiSummary.summaryText,
    latestSummaryConfidence:
      persistedAiReport?.confidence ?? aiSummary.summaryConfidence,
    summarySource: persistedAiReport?.source || "heuristic",
    summaryError: persistedAiReport?.error || null,
    possibleDeclineSignals: persistedAiReport?.possibleDeclineSignals || [],
    contributingFactors: persistedAiReport?.contributingFactors || [],
    drawingQualityScore: persistedAiReport?.drawingQualityScore ?? 0,
    drawingQualityNotes:
      persistedAiReport?.drawingQualityNotes || "Drawing quality score unavailable.",
    geminiInputContract: buildGeminiInputContract(latestAttempt, historyWithoutLatest),
  };
}
