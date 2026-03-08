export type FacialSignalsStatus = "unknown" | "available" | "limited" | "unavailable";

export type SessionQuality = "good" | "limited" | "unavailable";

export type PresageSignalSource = "presage-sdk" | "mock" | "unavailable";

export interface PresageSample {
  timestamp: number;
  facePresence: number;
  engagement: number;
  blinkRate: number;
  expressionVariability: number;
}

export interface DerivedSignalStats {
  avg: number;
  min: number;
  max: number;
  slope: number;
}

export interface PresageDerivedMetrics {
  sampleCount: number;
  startedAt: string;
  endedAt: string;
  facePresence: DerivedSignalStats;
  engagement: DerivedSignalStats;
  blinkRate: DerivedSignalStats;
  expressionVariability: DerivedSignalStats;
}

export interface SpeechMetrics {
  transcript: string;
  wordCount: number;
  speechRateWpm: number;
  vocabularyDiversity: number;
}

export interface RecallMetrics {
  matchedCount: number;
  totalTargetWords: number;
  accuracy: number;
  matchedWords: string[];
}

export interface Stage3Timestamps {
  listenPlayedAt: string | null;
  repeatStartedAt: string | null;
  repeatEndedAt: string | null;
}

export interface AssessmentAttemptPayload {
  capturedAt: string;
  memoryRecall: {
    score: number;
    maxScore: number;
  };
  drawing: {
    completedTasks: number;
    totalTasks: number;
    clockTimePrompt: string;
  };
  speech: SpeechMetrics;
  stage3: {
    targetWords: string[];
    recall: RecallMetrics;
    repeatDurationSeconds: number;
    phase: "listen" | "repeat" | "analyze";
    timestamps: Stage3Timestamps;
  };
  presage: {
    facialSignalsStatus: FacialSignalsStatus;
    sessionQuality: SessionQuality;
    source: PresageSignalSource;
    faceMissingEvents: number;
    faceMissingSeconds: number;
    metrics: PresageDerivedMetrics | null;
  };
}

export interface DashboardTrendPoint {
  label: string;
  value: number;
}

export interface SessionQualityBreakdown {
  good: number;
  limited: number;
  unavailable: number;
}

export interface ContributingSignal {
  signal: string;
  direction: "up" | "down" | "stable";
  delta: number;
  confidence: number;
  note: string;
}

export interface DoctorDashboardData {
  facialEngagementTrend: DashboardTrendPoint[];
  sessionQuality: SessionQualityBreakdown;
  contributingSignals: ContributingSignal[];
  latestSummary: string;
  latestSummaryConfidence: number;
}
