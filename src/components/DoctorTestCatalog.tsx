import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DoctorDashboardPatient, DoctorDeepAnalysisUiState } from "@/types/presage";

type DoctorTestCatalogProps = {
  patient?: DoctorDashboardPatient | null;
  deepAnalysis: DoctorDeepAnalysisUiState;
  onRunDeepAnalysis: (patientId: string) => Promise<void> | void;
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

const formatMaybeDateTime = (value: string | null) => {
  if (!value) return "N/A";
  return formatDateTime(value);
};

const getFlagText = (risk: DoctorDashboardPatient["risk"], recallScore: number) => {
  if (risk === "High" || recallScore < 60) return "Review recommended";
  return "Routine follow-up";
};

const DoctorTestCatalog = ({ patient, deepAnalysis, onRunDeepAnalysis }: DoctorTestCatalogProps) => {
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
  const completedTests =
    Number(latest.drawing.totalTasks > 0) +
    Number(latest.memoryChallenge.part1Total > 0 || latest.memoryChallenge.part3Total > 0) +
    Number(latest.speech.totalTargetWords > 0 || latest.speech.wordCount > 0 || latest.speech.skipped) +
    Number(latest.memoryRecall.maxScore > 0);
  const flagText = getFlagText(patient.risk, patient.recallScore);

  const recentAttempt = [
    { label: "Patient", value: `${patient.name} (${patient.code})` },
    { label: "Last Attempt", value: formatDateTime(patient.assessedAt) },
    { label: "Assessments Stored", value: String(patient.assessmentCount) },
    {
      label: "Drawing Exercise",
      value: `${latest.drawing.completedTasks}/${latest.drawing.totalTasks} (${formatPercent(latest.drawing.completionPercent)})`,
    },
    { label: "Drawing 1 Score", value: formatMaybeNumber(latest.drawing.drawing1Score, 0) },
    { label: "Drawing 2 Score", value: formatMaybeNumber(latest.drawing.drawing2Score, 0) },
    { label: "Drawing 3 Score", value: formatMaybeNumber(latest.drawing.drawing3Score, 0) },
    { label: "Drawing Scoring Status", value: latest.drawing.scoringStatus },
    { label: "Drawing Scored At", value: formatMaybeDateTime(latest.drawing.scoredAt) },
    {
      label: "Memory Challenge",
      value: `Part 1: ${latest.memoryChallenge.part1Correct}/${latest.memoryChallenge.part1Total}, Part 3: ${latest.memoryChallenge.part3Correct}/${latest.memoryChallenge.part3Total}`,
    },
    {
      label: "Spoken Recall",
      value: `${latest.speech.wordCount} words, ${latest.speech.speechRateWpm} WPM, Vocab ${formatPercent(latest.speech.vocabularyDiversityPercent)}`,
    },
    {
      label: "Word Recall Check",
      value: `${latest.memoryRecall.score}/${latest.memoryRecall.maxScore} (${formatPercent(latest.memoryRecall.accuracyPercent)})`,
    },
    {
      label: "Speech Match Count",
      value: `${latest.speech.matchedCount}/${latest.speech.totalTargetWords}`,
    },
    {
      label: "Facial Session Quality",
      value: `${latest.facial.sessionQuality} (${latest.facial.status})`,
    },
  ];

  if (latest.drawing.scoringError) {
    recentAttempt.push({
      label: "Drawing Scoring Error",
      value: latest.drawing.scoringError,
    });
  }

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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Deep Analysis</p>
            <Button
              size="sm"
              onClick={() => onRunDeepAnalysis(patient.id)}
              disabled={deepAnalysis.status === "loading"}
            >
              {deepAnalysis.status === "loading" ? "Running..." : "Run Deep Analysis"}
            </Button>
          </div>

          {deepAnalysis.status === "idle" ? (
            <p className="text-sm text-muted-foreground">
              Run a monitoring-only deep analysis for this patient using recent structured metrics.
            </p>
          ) : null}

          {deepAnalysis.status === "loading" ? (
            <p className="text-sm text-muted-foreground">Generating report from Backboard/Gemini...</p>
          ) : null}

          {deepAnalysis.status === "error" ? (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {deepAnalysis.error || "Unable to generate deep analysis right now."}
            </p>
          ) : null}

          {deepAnalysis.status === "success" && deepAnalysis.response ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border/60 bg-background/45 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Source: {deepAnalysis.response.source}
                  {deepAnalysis.response.model ? ` | Model: ${deepAnalysis.response.model}` : ""}
                  {deepAnalysis.response.generatedAt
                    ? ` | Generated: ${formatDateTime(deepAnalysis.response.generatedAt)}`
                    : ""}
                </p>
                <p className="mt-1 text-foreground">
                  {deepAnalysis.response.report.clinical_summary}
                </p>
                {deepAnalysis.response.error ? (
                  <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-xs text-amber-200">
                    {deepAnalysis.response.error}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border/60 bg-background/45 px-3 py-2">
                  <p className="mb-1 text-xs text-muted-foreground">Possible Decline Signals</p>
                  {deepAnalysis.response.report.possible_decline_signals.length ? (
                    <ul className="space-y-1 text-xs text-foreground/85">
                      {deepAnalysis.response.report.possible_decline_signals.map((item, index) => (
                        <li key={`possible-${index}`}>- {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No decline signals flagged.</p>
                  )}
                </div>

                <div className="rounded-md border border-border/60 bg-background/45 px-3 py-2">
                  <p className="mb-1 text-xs text-muted-foreground">Contributing Factors</p>
                  {deepAnalysis.response.report.contributing_factors.length ? (
                    <ul className="space-y-1 text-xs text-foreground/85">
                      {deepAnalysis.response.report.contributing_factors.map((item, index) => (
                        <li key={`factor-${index}`}>- {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No additional factors identified.</p>
                  )}
                </div>

                <div className="rounded-md border border-border/60 bg-background/45 px-3 py-2">
                  <p className="mb-1 text-xs text-muted-foreground">Data Quality Notes</p>
                  {deepAnalysis.response.report.data_quality_notes.length ? (
                    <ul className="space-y-1 text-xs text-foreground/85">
                      {deepAnalysis.response.report.data_quality_notes.map((item, index) => (
                        <li key={`quality-${index}`}>- {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No data quality concerns.</p>
                  )}
                </div>

                <div className="rounded-md border border-border/60 bg-background/45 px-3 py-2">
                  <p className="mb-1 text-xs text-muted-foreground">Recommended Follow-up Questions</p>
                  {deepAnalysis.response.report.recommended_followup_questions.length ? (
                    <ul className="space-y-1 text-xs text-foreground/85">
                      {deepAnalysis.response.report.recommended_followup_questions.map((item, index) => (
                        <li key={`followup-${index}`}>- {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No follow-up suggestions generated.</p>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Confidence: {deepAnalysis.response.report.confidence.toFixed(2)}
              </p>
            </div>
          ) : null}
        </div>

        {/*
        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">AI Monitoring Summary</p>
          <p className="text-sm text-foreground">{patient.summary}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Source: {patient.summarySource} | Confidence: {patient.latestSummaryConfidence}
          </p>
          {patient.summaryError ? (
            <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-xs text-amber-200">
              {patient.summaryError}
            </p>
          ) : null}
          {patient.possibleDeclineSignals.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted-foreground">Possible Decline Signals</p>
              <ul className="space-y-1 text-xs text-foreground/85">
                {patient.possibleDeclineSignals.slice(0, 4).map((item, index) => (
                  <li key={`possible-signal-${index}`}>- {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {patient.contributingFactors.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted-foreground">Contributing Factors</p>
              <ul className="space-y-1 text-xs text-foreground/85">
                {patient.contributingFactors.slice(0, 4).map((item, index) => (
                  <li key={`contributing-factor-${index}`}>- {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        */}

        {/*
        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Facial Session Snapshot</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Signal Source</span>
              <span className="font-medium text-foreground">{latest.facial.source}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Face Missing</span>
              <span className="font-medium text-foreground">{latest.facial.faceMissingEvents} events / {latest.facial.faceMissingSeconds}s</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Engagement Avg</span>
              <span className="font-medium text-foreground">{formatMaybeNumber(latest.facial.engagementAvg)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Blink Rate Avg</span>
              <span className="font-medium text-foreground">{formatMaybeNumber(latest.facial.blinkRateAvg)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Expression Variability Avg</span>
              <span className="font-medium text-foreground">{formatMaybeNumber(latest.facial.expressionVariabilityAvg)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2">
              <span className="text-muted-foreground">Face Presence Avg</span>
              <span className="font-medium text-foreground">{formatMaybeNumber(latest.facial.facePresenceAvg)}</span>
            </div>
          </div>
        </div>
        */}

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
            Session Quality: {latest.facial.sessionQuality}
          </Badge>
          <Badge className="border border-sky-500/30 bg-sky-500/10 text-sky-200">
            Drawing Scoring: {latest.drawing.scoringStatus}
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
