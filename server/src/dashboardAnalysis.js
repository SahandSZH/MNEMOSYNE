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

export function buildGeminiInputContract(latestAttempt, history) {
  return {
    memoryScore: latestAttempt.memoryRecall,
    drawingScore: latestAttempt.drawing,
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

  return {
    facialEngagementTrend,
    sessionQuality,
    contributingSignals: aiSummary.contributingSignals,
    latestSummary: aiSummary.summaryText,
    latestSummaryConfidence: aiSummary.summaryConfidence,
    geminiInputContract: buildGeminiInputContract(latestAttempt, historyWithoutLatest),
  };
}
