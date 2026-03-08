import type { PresageDerivedMetrics, PresageSample } from "@/types/presage";

const round = (value: number, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const safeDivide = (num: number, den: number) => (den === 0 ? 0 : num / den);

const linearSlope = (series: number[]) => {
  const n = series.length;
  if (n <= 1) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = series[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumXX - sumX * sumX;
  return safeDivide(numerator, denominator);
};

const summarize = (series: number[]) => {
  if (!series.length) {
    return { avg: 0, min: 0, max: 0, slope: 0 };
  }

  const avg = series.reduce((acc, value) => acc + value, 0) / series.length;
  return {
    avg: round(avg),
    min: round(Math.min(...series)),
    max: round(Math.max(...series)),
    slope: round(linearSlope(series)),
  };
};

export const normalizeSample = (sample: PresageSample): PresageSample => ({
  ...sample,
  facePresence: clamp(sample.facePresence, 0, 1),
  engagement: clamp(sample.engagement, 0, 1),
  blinkRate: clamp(sample.blinkRate, 0, 120),
  expressionVariability: clamp(sample.expressionVariability, 0, 1),
});

export const derivePresageMetrics = (
  samples: PresageSample[],
  startedAtMs: number,
): PresageDerivedMetrics | null => {
  if (!samples.length) return null;

  const normalized = samples.map(normalizeSample);
  const facePresence = normalized.map((sample) => sample.facePresence);
  const engagement = normalized.map((sample) => sample.engagement);
  const blinkRate = normalized.map((sample) => sample.blinkRate);
  const expressionVariability = normalized.map((sample) => sample.expressionVariability);
  const endedAtMs = normalized[normalized.length - 1].timestamp;

  return {
    sampleCount: normalized.length,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    facePresence: summarize(facePresence),
    engagement: summarize(engagement),
    blinkRate: summarize(blinkRate),
    expressionVariability: summarize(expressionVariability),
  };
};

export const calculateSpeechMetrics = (transcript: string, durationSeconds: number) => {
  const words = transcript
    .trim()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const wordCount = words.length;
  const uniqueWords = new Set(words.map((word) => word.toLowerCase()));
  const vocabularyDiversity = safeDivide(uniqueWords.size, wordCount || 1);
  const speechRateWpm = safeDivide(wordCount, durationSeconds || 1) * 60;

  return {
    transcript,
    wordCount,
    speechRateWpm: round(speechRateWpm, 2),
    vocabularyDiversity: round(vocabularyDiversity, 3),
  };
};
