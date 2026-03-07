import { FormEvent, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAssessment,
  uploadClockDrawing,
  uploadFacialMetrics,
  uploadSpeechFile,
} from "@/lib/api";

const API_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE || "https://dementia-monitoring-api";

type NullableRecord = Record<string, unknown> | null;

const PatientTest = () => {
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } = useAuth0();

  const [patientId, setPatientId] = useState("1");
  const [recallScore, setRecallScore] = useState("0");
  const [drawingScore, setDrawingScore] = useState("0");
  const [fluencyScore, setFluencyScore] = useState("0");
  const [sessionId, setSessionId] = useState("");
  const [assessmentId, setAssessmentId] = useState<number | null>(null);

  const [speechFile, setSpeechFile] = useState<File | null>(null);
  const [clockFile, setClockFile] = useState<File | null>(null);

  const [facePresenceScore, setFacePresenceScore] = useState("0.95");
  const [blinkRate, setBlinkRate] = useState("14");
  const [eyeFocusScore, setEyeFocusScore] = useState("0.78");
  const [expressionVariability, setExpressionVariability] = useState("0.42");

  const [assessmentResponse, setAssessmentResponse] = useState<NullableRecord>(null);
  const [speechResponse, setSpeechResponse] = useState<NullableRecord>(null);
  const [facialResponse, setFacialResponse] = useState<NullableRecord>(null);
  const [clockResponse, setClockResponse] = useState<NullableRecord>(null);
  const [errorText, setErrorText] = useState("");
  const [loadingKey, setLoadingKey] = useState("");

  const canSubmitSessionTasks = useMemo(
    () => Boolean(sessionId || assessmentId),
    [sessionId, assessmentId],
  );

  const getToken = async (): Promise<string | undefined> => {
    if (!isAuthenticated) {
      return undefined;
    }
    return getAccessTokenSilently({
      authorizationParams: {
        audience: API_AUDIENCE,
      },
    });
  };

  const runWithErrorHandling = async (key: string, action: () => Promise<void>) => {
    setLoadingKey(key);
    setErrorText("");
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown request error.";
      setErrorText(message);
    } finally {
      setLoadingKey("");
    }
  };

  const onCreateAssessment = (event: FormEvent) => {
    event.preventDefault();
    void runWithErrorHandling("assessment", async () => {
      const token = await getToken();
      const response = await createAssessment(
        {
          patient_id: Number(patientId),
          recall_score: Number(recallScore),
          drawing_score: Number(drawingScore),
          fluency_score: Number(fluencyScore),
        },
        token,
      );
      setAssessmentId(response.id);
      setSessionId(response.session_id || "");
      setAssessmentResponse(response as unknown as Record<string, unknown>);
    });
  };

  const onUploadSpeech = (event: FormEvent) => {
    event.preventDefault();
    if (!speechFile) {
      setErrorText("Please attach an audio file before uploading speech.");
      return;
    }
    void runWithErrorHandling("speech", async () => {
      const token = await getToken();
      const response = await uploadSpeechFile(
        {
          session_id: sessionId || undefined,
          assessment_id: assessmentId || undefined,
          audio_file: speechFile,
        },
        token,
      );
      setSpeechResponse(response as unknown as Record<string, unknown>);
    });
  };

  const onUploadFacialMetrics = (event: FormEvent) => {
    event.preventDefault();
    if (!sessionId) {
      setErrorText("session_id is required for facial metrics.");
      return;
    }
    void runWithErrorHandling("facial", async () => {
      const token = await getToken();
      const response = await uploadFacialMetrics(
        {
          patient_id: Number(patientId),
          session_id: sessionId,
          facial_metrics: {
            face_presence_score: Number(facePresenceScore),
            blink_rate: Number(blinkRate),
            eye_focus_score: Number(eyeFocusScore),
            expression_variability: Number(expressionVariability),
          },
        },
        token,
      );
      setFacialResponse(response as unknown as Record<string, unknown>);
    });
  };

  const onUploadClockDrawing = (event: FormEvent) => {
    event.preventDefault();
    if (!clockFile) {
      setErrorText("Please attach an image file before uploading clock drawing.");
      return;
    }
    void runWithErrorHandling("clock", async () => {
      const token = await getToken();
      const response = await uploadClockDrawing(
        {
          session_id: sessionId || undefined,
          assessment_id: assessmentId || undefined,
          image_file: clockFile,
          run_analysis: true,
        },
        token,
      );
      setClockResponse(response as unknown as Record<string, unknown>);
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 text-foreground">
      <div className="space-y-2">
        <Link to="/" className="text-sm text-primary underline-offset-2 hover:underline">
          Back to Home
        </Link>
        <h1 className="text-2xl font-semibold">Patient Assessment Workflow</h1>
        <p className="text-sm text-muted-foreground">
          This page wires frontend actions directly to backend endpoints.
        </p>
        {!isAuthenticated && (
          <Button onClick={() => loginWithRedirect()} className="mt-2">
            Sign In to Run Protected APIs
          </Button>
        )}
      </div>

      {errorText && (
        <div className="rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
          {errorText}
        </div>
      )}

      <form onSubmit={onCreateAssessment} className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-medium">1. Create Assessment</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="patient_id">patient_id</Label>
            <Input
              id="patient_id"
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="recall_score">recall_score</Label>
            <Input
              id="recall_score"
              value={recallScore}
              onChange={(event) => setRecallScore(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="drawing_score">drawing_score</Label>
            <Input
              id="drawing_score"
              value={drawingScore}
              onChange={(event) => setDrawingScore(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fluency_score">fluency_score</Label>
            <Input
              id="fluency_score"
              value={fluencyScore}
              onChange={(event) => setFluencyScore(event.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={loadingKey === "assessment"}>
          {loadingKey === "assessment" ? "Creating..." : "Create Assessment"}
        </Button>
      </form>

      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-medium">Session Context</h2>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <p>
            <span className="font-medium">assessment_id:</span> {assessmentId ?? "-"}
          </p>
          <p>
            <span className="font-medium">session_id:</span> {sessionId || "-"}
          </p>
        </div>
      </div>

      <form onSubmit={onUploadSpeech} className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-medium">2. Upload Speech (`/speech`)</h2>
        <Input
          type="file"
          accept="audio/*"
          onChange={(event) => setSpeechFile(event.target.files?.[0] || null)}
        />
        <Button type="submit" disabled={!canSubmitSessionTasks || loadingKey === "speech"}>
          {loadingKey === "speech" ? "Uploading..." : "Upload Speech File"}
        </Button>
      </form>

      <form onSubmit={onUploadFacialMetrics} className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-medium">3. Upload Facial Metrics (`/biometrics/facial`)</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="face_presence_score">face_presence_score</Label>
            <Input
              id="face_presence_score"
              value={facePresenceScore}
              onChange={(event) => setFacePresenceScore(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="blink_rate">blink_rate</Label>
            <Input
              id="blink_rate"
              value={blinkRate}
              onChange={(event) => setBlinkRate(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="eye_focus_score">eye_focus_score</Label>
            <Input
              id="eye_focus_score"
              value={eyeFocusScore}
              onChange={(event) => setEyeFocusScore(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="expression_variability">expression_variability</Label>
            <Input
              id="expression_variability"
              value={expressionVariability}
              onChange={(event) => setExpressionVariability(event.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={!sessionId || loadingKey === "facial"}>
          {loadingKey === "facial" ? "Submitting..." : "Submit Facial Metrics"}
        </Button>
      </form>

      <form onSubmit={onUploadClockDrawing} className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-medium">4. Upload Clock Drawing (`/clock-drawing`)</h2>
        <Input
          type="file"
          accept="image/*"
          onChange={(event) => setClockFile(event.target.files?.[0] || null)}
        />
        <Button type="submit" disabled={!canSubmitSessionTasks || loadingKey === "clock"}>
          {loadingKey === "clock" ? "Uploading..." : "Upload Clock Drawing"}
        </Button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <ResponseBlock title="Assessment Response" data={assessmentResponse} />
        <ResponseBlock title="Speech Response" data={speechResponse} />
        <ResponseBlock title="Facial Response" data={facialResponse} />
        <ResponseBlock title="Clock Drawing Response" data={clockResponse} />
      </div>
    </div>
  );
};

const ResponseBlock = ({ title, data }: { title: string; data: NullableRecord }) => (
  <section className="rounded-lg border p-4">
    <h3 className="mb-2 font-medium">{title}</h3>
    <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  </section>
);

export default PatientTest;
