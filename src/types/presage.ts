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

export interface AssessmentTiming {
  assessmentStartedAt: string | null;
  assessmentEndedAt: string | null;
  totalDurationSeconds: number;
  tests: {
    test0Seconds: number;
    test1Seconds: number;
    test2Seconds: number;
    test3Seconds: number;
  };
}

export interface AssessmentTestData {
  test0Words: string[];
  test1Drawings: Record<number, string>;
  test2: {
    part1: {
      objects: { emoji: string; label: string }[];
      options: { emoji: string; label: string }[];
      selections: string[];
    };
    part2: {
      expectedAnswer: string | number;
      answer: string;
      isCorrect: boolean | null;
    };
    part3: {
      targetSequence: string[];
      userSequence: string[];
    };
  };
  test3: {
    promptWords: string[];
    promptText: string;
    skipped: boolean;
    micPermission: "unknown" | "granted" | "denied";
  };
}

export interface AssessmentAttemptPayload {
  capturedAt: string;
  tests: {
    test0And4: {
      randomWords: string[];
      userInputs: string[];
    };
    test1: {
      clockTimePrompt: string;
      drawings: {
        step1: string | null;
        step2: string | null;
        step3: string | null;
      };
    };
    test2: {
      part1: {
        randomPrompt: string[];
        userAnswer: string[];
      };
      part2: {
        randomPrompt: string;
        expectedAnswer: string | number;
        userAnswer: string;
        isCorrect: boolean | null;
      };
      part3: {
        randomPrompt: string[];
        userAnswer: string[];
      };
    };
    test3: {
      chosenWords: string[];
      userResponses: string[];
      transcript: string;
    };
  };
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
  timing: AssessmentTiming;
  testData: AssessmentTestData;
}

export interface ContributingSignal {
  signal: string;
  direction: "up" | "down" | "stable";
  delta: number;
  confidence: number;
  note: string;
}

export type DoctorRiskLevel = "Low" | "Moderate" | "High";

export interface DoctorDashboardTrendPoint {
  label: string;
  capturedAt: string;
  cognitive: number;
  speech: number;
  memory: number;
}

export interface DoctorDashboardActivity {
  id: string;
  patientId: string;
  patientName: string;
  at: string;
  note: string;
  type: "assessment" | "follow-up" | "flag";
}

export interface DoctorDashboardTimingSummary {
  assessmentStartedAt: string | null;
  assessmentEndedAt: string | null;
  totalDurationSeconds: number;
}

export interface DoctorDashboardLatestMemoryRecall {
  score: number;
  maxScore: number;
  accuracyPercent: number;
  durationSeconds: number;
}

export interface DoctorDashboardLatestMemoryChallenge {
  part1Correct: number;
  part1Total: number;
  part1AccuracyPercent: number;
  part3Correct: number;
  part3Total: number;
  part3AccuracyPercent: number;
  durationSeconds: number;
}

export interface DoctorDashboardLatestDrawing {
  completedTasks: number;
  totalTasks: number;
  completionPercent: number;
  durationSeconds: number;
  drawing1Score: number | null;
  drawing2Score: number | null;
  drawing3Score: number | null;
  scoringStatus: "pending" | "success" | "fallback" | "error";
  scoredAt: string | null;
  scoringError: string | null;
  drawing_1_score: number | null;
  drawing_2_score: number | null;
  drawing_3_score: number | null;
  scoring_status: "pending" | "success" | "fallback" | "error";
  scored_at: string | null;
}

export interface DoctorDashboardLatestSpeech {
  wordCount: number;
  speechRateWpm: number;
  vocabularyDiversityPercent: number;
  recallAccuracyPercent: number;
  matchedCount: number;
  totalTargetWords: number;
  durationSeconds: number;
  phase: string;
  micPermission: string;
  skipped: boolean;
  listenPlayedAt: string | null;
  repeatStartedAt: string | null;
  repeatEndedAt: string | null;
}

export interface DoctorDashboardLatestFacial {
  status: string;
  sessionQuality: string;
  source: string;
  faceMissingEvents: number;
  faceMissingSeconds: number;
  sampleCount: number;
  startedAt: string | null;
  endedAt: string | null;
  engagementAvg: number | null;
  blinkRateAvg: number | null;
  expressionVariabilityAvg: number | null;
  facePresenceAvg: number | null;
}

export interface DoctorDashboardLatestAssessment {
  assessmentId: number;
  capturedAt: string;
  submittedAt: string | null;
  timing: DoctorDashboardTimingSummary;
  memoryRecall: DoctorDashboardLatestMemoryRecall;
  memoryChallenge: DoctorDashboardLatestMemoryChallenge;
  drawing: DoctorDashboardLatestDrawing;
  speech: DoctorDashboardLatestSpeech;
  facial: DoctorDashboardLatestFacial;
}

export interface DoctorDashboardPatientAggregates {
  avgRecallAccuracyPercent: number;
  avgDrawingCompletionPercent: number;
  avgSpeechWordCount: number;
  avgSpeechRateWpm: number;
  avgVocabularyDiversityPercent: number;
  avgSessionDurationSeconds: number;
  avgFaceMissingSeconds: number;
}

export interface DoctorDashboardDataCoverage {
  memoryRecall: number;
  drawing: number;
  memoryChallenge: number;
  speech: number;
  facial: number;
}

export interface DoctorDashboardPatient {
  id: string;
  name: string;
  email: string;
  code: string;
  risk: DoctorRiskLevel;
  assessedAt: string;
  firstAssessedAt: string;
  assessmentCount: number;
  recallScore: number;
  speechScore: number;
  memoryScore: number;
  engagementScore: number;
  summary: string;
  contributingSignals: ContributingSignal[];
  trends: DoctorDashboardTrendPoint[];
  activities: DoctorDashboardActivity[];
  sessionQuality: string;
  latestSummaryConfidence: number;
  summarySource: string;
  summaryError: string | null;
  possibleDeclineSignals: string[];
  contributingFactors: string[];
  latestAssessment: DoctorDashboardLatestAssessment;
  aggregates: DoctorDashboardPatientAggregates;
  dataCoverage: DoctorDashboardDataCoverage;
}

export interface DoctorDashboardKpis {
  totalPatients: number;
  totalAssessments: number;
  newAssessments: number;
  highRiskPatients: number;
  avgCognitiveTrendDelta: number;
  avgSessionDurationSeconds: number;
  limitedSignalSessions: number;
  unavailableSignalSessions: number;
}

export interface DoctorDashboardPriorityItem {
  patientId: string;
  name: string;
  code: string;
  risk: DoctorRiskLevel;
  cognitiveDelta: number;
}

export interface DoctorDashboardData {
  generatedAt: string;
  kpis: DoctorDashboardKpis;
  patients: DoctorDashboardPatient[];
  priorityQueue: DoctorDashboardPriorityItem[];
  activities: DoctorDashboardActivity[];
}

export interface DoctorDeepAnalysisReport {
  clinical_summary: string;
  possible_decline_signals: string[];
  contributing_factors: string[];
  data_quality_notes: string[];
  recommended_followup_questions: string[];
  confidence: number;
}

export type DoctorDeepAnalysisStatus = "idle" | "loading" | "success" | "error";

export interface DoctorDeepAnalysisResponse {
  id: number;
  patientId: string;
  assessmentCount: number;
  generatedAt: string | null;
  source: string;
  model: string | null;
  status: "success" | "fallback" | "error";
  error: string | null;
  report: DoctorDeepAnalysisReport;
}

export interface DoctorDeepAnalysisUiState {
  status: DoctorDeepAnalysisStatus;
  response: DoctorDeepAnalysisResponse | null;
  error: string;
}
