import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type DoctorTestCatalogPatient = {
  name: string;
  code: string;
  assessedAt: string;
  risk: "Low" | "Moderate" | "High";
  recallScore: number;
  speechScore: number;
  engagementScore: number;
};

type DoctorTestCatalogProps = {
  patient?: DoctorTestCatalogPatient | null;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const toMemoryChallenge = (recallScore: number) =>
  `${Math.max(1, Math.min(5, Math.round(recallScore / 20)))}/5`;

const toRecallCheck = (recallScore: number) =>
  `${Math.max(0, Math.min(3, Math.round(recallScore / 34)))}/3`;

const toSpokenRecall = (speechScore: number) =>
  `${Math.max(8, Math.round(speechScore / 4))} words in 60s`;

const getSessionQuality = (engagementScore: number) => {
  if (engagementScore >= 75) return "Good";
  if (engagementScore >= 60) return "Limited";
  return "Needs Review";
};

const getFlagText = (risk: DoctorTestCatalogPatient["risk"], recallScore: number) => {
  if (risk === "High" || recallScore < 60) return "Review recommended";
  return "Routine follow-up";
};

const DoctorTestCatalog = ({ patient }: DoctorTestCatalogProps) => {
  const drawingStatus = patient?.risk === "High" ? "Partial" : "Completed";
  const completedTests = drawingStatus === "Completed" ? "4/4" : "3/4";
  const sessionQuality = getSessionQuality(patient?.engagementScore ?? 72);
  const flagText = getFlagText(patient?.risk ?? "Moderate", patient?.recallScore ?? 65);

  const recentAttempt = [
    { label: "Patient", value: patient ? `${patient.name} (${patient.code})` : "No patient selected" },
    { label: "Drawing Exercise", value: drawingStatus },
    { label: "Memory Challenge", value: toMemoryChallenge(patient?.recallScore ?? 65) },
    { label: "Spoken Recall", value: toSpokenRecall(patient?.speechScore ?? 70) },
    { label: "Word Recall Check", value: toRecallCheck(patient?.recallScore ?? 65) },
    { label: "Last Attempt Date", value: patient ? formatDate(patient.assessedAt) : "-" },
  ];

  return (
    <Card className="border-border/70 bg-card/75">
      <CardHeader>
        <CardTitle className="font-display text-xl">Assessment Test Suite</CardTitle>
        <CardDescription>
          Current test set used in patient assessment flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-border/70 bg-background/35 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            What Each Test Measures
          </p>
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
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
            Recent Patient Attempt (Dummy Data)
          </p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {recentAttempt.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-md border border-border/60 bg-background/45 px-3 py-2"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
            Completed Tests: {completedTests}
          </Badge>
          <Badge className="border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
            Overall Session Quality: {sessionQuality}
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
