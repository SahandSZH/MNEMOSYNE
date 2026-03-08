import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DoctorDashboardPatient } from "@/types/presage";

type DoctorTestCatalogProps = {
  patient?: DoctorDashboardPatient | null;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toText = (value: unknown, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  const parsed = String(value);
  return parsed.trim() ? parsed : fallback;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatPercent = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

const formatMaybeNumber = (value: number | null, digits = 2) => {
  if (value === null || Number.isNaN(value)) return "N/A";
  return value.toFixed(digits);
};

const normalizeImageSrc = (value: string | null) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
};

const isRenderableImage = (value: string | null) => {
  const normalized = normalizeImageSrc(value);
  if (!normalized) return false;
  return normalized.startsWith("data:image/") || normalized.startsWith("http://") || normalized.startsWith("https://");
};

const getFlagText = (risk: DoctorDashboardPatient["risk"], recallScore: number) => {
  if (risk === "High" || recallScore < 60) return "Review recommended";
  return "Routine follow-up";
};

const DoctorTestCatalog = ({ patient }: DoctorTestCatalogProps) => {
  if (!patient) {
    return (
      <Card className="border-border/70 bg-card/75">
        <CardHeader>
          <CardTitle className="font-display text-xl">Assessment Test Suite</CardTitle>
          <CardDescription>Select a patient to view assessment metrics from the database.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const latest = patient.latestAssessment;
  if (!latest) {
    return (
      <Card className="border-border/70 bg-card/75">
        <CardHeader>
          <CardTitle className="font-display text-xl">Assessment Test Suite</CardTitle>
          <CardDescription>
            No latest assessment payload is available for this patient yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const drawingQualityScore = toNullableNumber(patient.drawingQualityScore);
  const drawingQualityNotes = toText(
    patient.drawingQualityNotes,
    "Drawing quality notes are unavailable for this assessment.",
  );
  const possibleDeclineSignals = Array.isArray(patient.possibleDeclineSignals)
    ? patient.possibleDeclineSignals
    : [];
  const contributingFactors = Array.isArray(patient.contributingFactors)
    ? patient.contributingFactors
    : [];
  const summarySource = toText(patient.summarySource, "unknown");
  const summaryConfidence = toNumber(patient.latestSummaryConfidence, 0);
  const summaryText = toText(patient.summary, "No AI summary available.");
  const drawing = latest.drawing || {
    completedTasks: 0,
    totalTasks: 0,
    completionPercent: 0,
    durationSeconds: 0,
    step1ImageDataUrl: null,
    step2ImageDataUrl: null,
    step3ImageDataUrl: null,
  };
  const memoryChallenge = latest.memoryChallenge || {
    part1Correct: 0,
    part1Total: 0,
    part1AccuracyPercent: 0,
    part3Correct: 0,
    part3Total: 0,
    part3AccuracyPercent: 0,
    durationSeconds: 0,
  };
  const speech = latest.speech || {
    wordCount: 0,
    speechRateWpm: 0,
    vocabularyDiversityPercent: 0,
    recallAccuracyPercent: 0,
    matchedCount: 0,
    totalTargetWords: 0,
    durationSeconds: 0,
    phase: "listen",
    micPermission: "unknown",
    skipped: false,
    listenPlayedAt: null,
    repeatStartedAt: null,
    repeatEndedAt: null,
  };
  const memoryRecall = latest.memoryRecall || {
    score: 0,
    maxScore: 0,
    accuracyPercent: 0,
    durationSeconds: 0,
  };
  const facial = latest.facial || {
    status: "unknown",
    sessionQuality: "unavailable",
    source: "unavailable",
    faceMissingEvents: 0,
    faceMissingSeconds: 0,
    sampleCount: 0,
    startedAt: null,
    endedAt: null,
    engagementAvg: null,
    blinkRateAvg: null,
    expressionVariabilityAvg: null,
    facePresenceAvg: null,
  };

  const completedTests =
    Number(drawing.totalTasks > 0) +
    Number(memoryChallenge.part1Total > 0 || memoryChallenge.part3Total > 0) +
    Number(speech.totalTargetWords > 0 || speech.wordCount > 0 || speech.skipped) +
    Number(memoryRecall.maxScore > 0);
  const flagText = getFlagText(patient.risk, patient.recallScore);

  const recentAttempt = [
    { label: "Patient", value: `${patient.name} (${patient.code})` },
    { label: "Last Attempt", value: formatDateTime(patient.assessedAt) },
    { label: "Assessments Stored", value: String(patient.assessmentCount) },
    {
      label: "Drawing Exercise",
      value: `${drawing.completedTasks}/${drawing.totalTasks} (${formatPercent(drawing.completionPercent)})`,
    },
    {
      label: "Memory Challenge",
      value: `Part 1: ${memoryChallenge.part1Correct}/${memoryChallenge.part1Total}, Part 3: ${memoryChallenge.part3Correct}/${memoryChallenge.part3Total}`,
    },
    {
      label: "Spoken Recall",
      value: `${speech.wordCount} words, ${speech.speechRateWpm} WPM, Vocab ${formatPercent(speech.vocabularyDiversityPercent)}`,
    },
    {
      label: "Word Recall Check",
      value: `${memoryRecall.score}/${memoryRecall.maxScore} (${formatPercent(memoryRecall.accuracyPercent)})`,
    },
    {
      label: "Speech Match Count",
      value: `${speech.matchedCount}/${speech.totalTargetWords}`,
    },
    {
      label: "Facial Session Quality",
      value: `${facial.sessionQuality} (${facial.status})`,
    },
    {
      label: "AI Drawing Score",
      value: drawingQualityScore === null ? "Pending" : `${drawingQualityScore.toFixed(1)}/100`,
    },
  ];

  const averageMetrics = [
    { label: "Avg Recall Accuracy", value: formatPercent(patient.aggregates.avgRecallAccuracyPercent) },
    { label: "Avg Drawing Completion", value: formatPercent(patient.aggregates.avgDrawingCompletionPercent) },
    { label: "Avg Speech Word Count", value: String(patient.aggregates.avgSpeechWordCount) },
    { label: "Avg Speech Rate", value: `${patient.aggregates.avgSpeechRateWpm} WPM` },
    {
      label: "Avg Vocabulary Diversity",
      value: formatPercent(patient.aggregates.avgVocabularyDiversityPercent),
    },
    { label: "Avg Session Duration", value: `${patient.aggregates.avgSessionDurationSeconds}s` },
    { label: "Avg Face Missing Time", value: `${patient.aggregates.avgFaceMissingSeconds}s` },
  ];

  return (
    <Card className="border-border/70 bg-card/75">
      <CardHeader>
        <CardTitle className="font-display text-xl">Assessment Test Suite</CardTitle>
        <CardDescription>Database-backed test metrics (raw words/transcripts are intentionally excluded).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">What Each Test Measures</p>
          <div className="grid gap-2 text-sm text-foreground/90 sm:grid-cols-2">
            <p>
              <span className="font-medium text-foreground">Memory:</span> initial recall and delayed recall consistency.
            </p>
            <p>
              <span className="font-medium text-foreground">Executive Function:</span> drawing and structured challenge performance.
            </p>
            <p>
              <span className="font-medium text-foreground">Speech / Fluency:</span> spoken recall pace and verbal output quality.
            </p>
            <p>
              <span className="font-medium text-foreground">Follow-up Recall:</span> retention stability compared with baseline.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Recent Patient Attempt</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {recentAttempt.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background/45 px-3 py-2"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className="text-right font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Averages Across Assessments</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {averageMetrics.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background/45 px-3 py-2"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">AI Monitoring Summary</p>
          <p className="text-sm text-foreground">{summaryText}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Source: {summarySource} | Confidence: {summaryConfidence}
          </p>
          <p className="mt-2 text-xs text-foreground/90">
            Drawing Quality Score: {drawingQualityScore === null ? "Pending" : `${drawingQualityScore.toFixed(1)}/100`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{drawingQualityNotes}</p>
          {patient.summaryError ? (
            <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-xs text-amber-200">
              {patient.summaryError}
            </p>
          ) : null}
          {possibleDeclineSignals.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted-foreground">Possible Decline Signals</p>
              <ul className="space-y-1 text-xs text-foreground/85">
                {possibleDeclineSignals.slice(0, 4).map((item, index) => (
                  <li key={`possible-signal-${index}`}>- {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {contributingFactors.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted-foreground">Contributing Factors</p>
              <ul className="space-y-1 text-xs text-foreground/85">
                {contributingFactors.slice(0, 4).map((item, index) => (
                  <li key={`contributing-factor-${index}`}>- {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Latest Drawing Images</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Clock", value: drawing.step1ImageDataUrl },
              { label: "Pentagons", value: drawing.step2ImageDataUrl },
              { label: "Cube", value: drawing.step3ImageDataUrl },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-border/60 bg-background/45 p-2"
              >
                <p className="mb-2 text-xs text-muted-foreground">{item.label}</p>
                {isRenderableImage(item.value) ? (
                  <img
                    src={normalizeImageSrc(item.value) || ""}
                    alt={`${item.label} drawing`}
                    className="h-36 w-full rounded border border-border/60 object-contain bg-white"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center rounded border border-dashed border-border/60 text-xs text-muted-foreground">
                    No image saved
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Facial Session Snapshot</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Signal Source</span>
              <span className="font-medium text-foreground">{facial.source}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Face Missing</span>
              <span className="font-medium text-foreground">{facial.faceMissingEvents} events / {facial.faceMissingSeconds}s</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Engagement Avg</span>
              <span className="font-medium text-foreground">{formatMaybeNumber(facial.engagementAvg)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Blink Rate Avg</span>
              <span className="font-medium text-foreground">{formatMaybeNumber(facial.blinkRateAvg)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Expression Variability Avg</span>
              <span className="font-medium text-foreground">{formatMaybeNumber(facial.expressionVariabilityAvg)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Face Presence Avg</span>
              <span className="font-medium text-foreground">{formatMaybeNumber(facial.facePresenceAvg)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Data Coverage in Database</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Memory Recall</span>
              <span className="font-medium text-foreground">{patient.dataCoverage.memoryRecall}/{patient.assessmentCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Drawing</span>
              <span className="font-medium text-foreground">{patient.dataCoverage.drawing}/{patient.assessmentCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Memory Challenge</span>
              <span className="font-medium text-foreground">{patient.dataCoverage.memoryChallenge}/{patient.assessmentCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Speech</span>
              <span className="font-medium text-foreground">{patient.dataCoverage.speech}/{patient.assessmentCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Facial</span>
              <span className="font-medium text-foreground">{patient.dataCoverage.facial}/{patient.assessmentCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Monitoring Window</span>
              <span className="font-medium text-foreground">{formatDate(patient.firstAssessedAt)} - {formatDate(patient.assessedAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
            Completed Tests: {completedTests}/4
          </Badge>
          <Badge className="border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
            Session Quality: {facial.sessionQuality}
          </Badge>
          <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-200">
            Flag: {flagText}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default DoctorTestCatalog;
