import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { calculateSpeechMetrics, derivePresageMetrics } from "@/lib/presageMetrics";
import { startPresageRuntime } from "@/lib/presageRuntime";
import type {
  AssessmentAttemptPayload,
  FacialSignalsStatus,
  PresageDerivedMetrics,
  RecallMetrics,
  PresageSample,
  PresageSignalSource,
  SessionQuality,
} from "@/types/presage";

const totalSteps = 8;
const finalStep = totalSteps - 1;
const totalTests = 4;

const drawingStepStart = 1;
const drawingStepEnd = 3;
const test2StepStart = 4;
const test2StepEnd = 6;
const test3Step = 7;
const faceMissingThresholdSeconds =
  Number(import.meta.env.VITE_FACE_MISSING_THRESHOLD_SECONDS || 3) || 3;
const authAudience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://mnemosyne-api";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const configuredStage3RepeatSeconds =
  Number(import.meta.env.VITE_STAGE3_REPEAT_SECONDS || 45) || 45;
const stage3RepeatDurationSeconds = Math.max(
  30,
  Math.min(60, configuredStage3RepeatSeconds),
);

const drawingReferenceImages: Partial<Record<number, string>> = {
  2: "/Conjoined pentagons.png",
  3: "/Cube.png",
};

const objectPool = [
  { emoji: "🍎", label: "Apple" },
  { emoji: "🚗", label: "Car" },
  { emoji: "🏠", label: "House" },
  { emoji: "📚", label: "Books" },
  { emoji: "🕰️", label: "Clock" },
  { emoji: "🎈", label: "Balloon" },
  { emoji: "🧸", label: "Teddy Bear" },
  { emoji: "🍕", label: "Pizza" },
  { emoji: "🌳", label: "Tree" },
  { emoji: "🧩", label: "Puzzle" },
  { emoji: "🎸", label: "Guitar" },
  { emoji: "🧠", label: "Brain" },
] as const;

const colorEmojiPool = ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪"] as const;

const pickRandomWords = (sourceWords: string[], amount: number) => {
  const shuffled = [...sourceWords];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }
  return shuffled.slice(0, amount);
};

const pickRandomUnique = <T,>(source: T[], amount: number) => {
  const shuffled = [...source];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }
  return shuffled.slice(0, amount);
};

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomOp = () => (Math.random() < 0.5 ? "+" : "-");

const makeRandomClockTime = () => {
  const hour = randomInt(1, 12);
  const minute = randomInt(0, 11) * 5;
  return `${hour}:${minute.toString().padStart(2, "0")}`;
};

const makeEquation = () => {
  const a = randomInt(1, 10);
  const b = randomInt(1, 10);
  const c = randomInt(1, 10);
  const op1 = randomOp();
  const op2 = randomOp();
  const expression = `${a} ${op1} ${b} ${op2} ${c}`;
  const first = op1 === "+" ? a + b : a - b;
  const expectedAnswer = op2 === "+" ? first + c : first - c;
  return { expression, expectedAnswer };
};

const makeRandomColorSequence = () =>
  Array.from({ length: 6 }, () => colorEmojiPool[randomInt(0, colorEmojiPool.length - 1)]);

const normalizeWord = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const computeRecallMetrics = (targetWords: string[], transcript: string): RecallMetrics => {
  const normalizedTargets = targetWords.map(normalizeWord).filter(Boolean);
  const spokenWords = transcript
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);
  const spokenSet = new Set(spokenWords);
  const matchedWords = targetWords.filter((word) => spokenSet.has(normalizeWord(word)));
  const matchedNormalized = new Set(matchedWords.map((word) => normalizeWord(word)));
  const matchedCount = matchedNormalized.size;
  const totalTargetWords = normalizedTargets.length;
  const accuracy = totalTargetWords > 0 ? matchedCount / totalTargetWords : 0;

  return {
    matchedCount,
    totalTargetWords,
    accuracy: Number(accuracy.toFixed(3)),
    matchedWords,
  };
};

const getTestNumberForStep = (step: number) => {
  if (step === 0) return 0;
  if (step >= 1 && step <= 3) return 1;
  if (step >= 4 && step <= 6) return 2;
  return 3;
};

const blobToBase64 = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const getApiErrorMessage = async (response: Response, fallback: string) => {
  const text = await response.text();
  return text || fallback;
};

const buildInitialData = () => {
  const objects = pickRandomUnique([...objectPool], 3);
  const distractors = pickRandomUnique(
    objectPool.filter((x) => !objects.some((o) => o.label === x.label)),
    3,
  );
  const options = pickRandomUnique([...objects, ...distractors], 6);
  const equation = makeEquation();

  return {
    equationText: equation.expression,
    // to analyze
    data: {
      test0Words: [] as string[],
      test1Drawings: {} as Record<number, string>,
      test2: {
        part1: { objects, options, selections: [] as string[] },
        part2: { expectedAnswer: equation.expectedAnswer, answer: "" },
        part3: { targetSequence: makeRandomColorSequence(), userSequence: [] as string[] },
      },
      test3: {
        promptWords: [] as string[],
        promptText: "",
        transcript: "",
        skipped: false,
        micPermission: "unknown" as "unknown" | "granted" | "denied",
      },
    },
  };
};

const Assessment = () => {
  const navigate = useNavigate();
  const { isAuthenticated, getAccessTokenSilently, getAccessTokenWithPopup } = useAuth0();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const presageVideoRef = useRef<HTMLVideoElement | null>(null);
  const isDrawingRef = useRef(false);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const presageControllerRef = useRef<{ stop: () => void } | null>(null);
  const presageSamplesRef = useRef<PresageSample[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingStoppedAtRef = useRef<number | null>(null);
  const listenPlayedAtRef = useRef<number | null>(null);
  const faceMissingEventsRef = useRef(0);
  const faceMissingSecondsRef = useRef(0);
  const faceLastSeenAtRef = useRef<number | null>(null);
  const facePromptShownRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const initial = useRef(buildInitialData());

  const [step, setStep] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [nextStep, setNextStep] = useState(0);
  const [isFlashVisible, setIsFlashVisible] = useState(false);
  const [flashCountdown, setFlashCountdown] = useState(7);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [equationText, setEquationText] = useState(initial.current.equationText);
  const [assessmentData, setAssessmentData] = useState(initial.current.data);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingPrompt, setIsPlayingPrompt] = useState(false);
  const [test3Status, setTest3Status] = useState("");
  const [test3Error, setTest3Error] = useState("");
  const [test3Phase, setTest3Phase] = useState<"listen" | "repeat" | "analyze">("listen");
  const [repeatRemainingSeconds, setRepeatRemainingSeconds] = useState(
    stage3RepeatDurationSeconds,
  );
  const [recallMetrics, setRecallMetrics] = useState<RecallMetrics>({
    matchedCount: 0,
    totalTargetWords: 0,
    accuracy: 0,
    matchedWords: [],
  });
  const [saveStatus, setSaveStatus] = useState("");
  const [presageMetrics, setPresageMetrics] = useState<PresageDerivedMetrics | null>(null);
  const [facialSignalsStatus, setFacialSignalsStatus] =
    useState<FacialSignalsStatus>("unknown");
  const [sessionQuality, setSessionQuality] = useState<SessionQuality>("unavailable");
  const [signalSource, setSignalSource] = useState<PresageSignalSource>("unavailable");
  const [faceMissingPrompt, setFaceMissingPrompt] = useState(false);
  const [faceMissingSeconds, setFaceMissingSeconds] = useState(0);
  const [faceMissingEvents, setFaceMissingEvents] = useState(0);
  const clockInstructionTime = useMemo(() => makeRandomClockTime(), []);
  const drawingInstructions = useMemo(
    () => ({
      1: `Draw an analog clock at time: ${clockInstructionTime}`,
      2: "Copy the conjoined pentagons shown in the top-left.",
      3: "Copy the cube shown in the top-left.",
    }),
    [clockInstructionTime],
  );

  const progressValue = useMemo(() => ((step + 1) / totalSteps) * 100, [step]);
  const currentTestNumber = useMemo(() => getTestNumberForStep(step), [step]);
  const nextTestNumber = useMemo(() => getTestNumberForStep(nextStep), [nextStep]);

  const getApiToken = async () => {
    try {
      return await getAccessTokenSilently({
        authorizationParams: { audience: authAudience },
      });
    } catch (error) {
      const code =
        typeof error === "object" && error ? (error as { error?: string }).error : "";
      if (code === "consent_required" || code === "login_required") {
        return getAccessTokenWithPopup({
          authorizationParams: { audience: authAudience },
        });
      }
      throw error;
    }
  };

  const resetStage3Attempt = () => {
    stopPresageCapture();
    mediaRecorderRef.current = null;
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;

    setIsRecording(false);
    setIsPlayingPrompt(false);
    setTest3Status("");
    setTest3Error("");
    setTest3Phase("listen");
    setRepeatRemainingSeconds(stage3RepeatDurationSeconds);
    setRecallMetrics({
      matchedCount: 0,
      totalTargetWords: 0,
      accuracy: 0,
      matchedWords: [],
    });

    setFacialSignalsStatus("unknown");
    setSessionQuality("unavailable");
    setSignalSource("unavailable");
    setFaceMissingPrompt(false);
    setFaceMissingSeconds(0);
    setFaceMissingEvents(0);
    setPresageMetrics(null);
    setSaveStatus("");

    faceMissingSecondsRef.current = 0;
    faceMissingEventsRef.current = 0;
    faceLastSeenAtRef.current = null;
    facePromptShownRef.current = false;
    presageSamplesRef.current = [];
    recordingStartedAtRef.current = null;
    recordingStoppedAtRef.current = null;
    listenPlayedAtRef.current = null;
    chunksRef.current = [];

    setAssessmentData((prev) => ({
      ...prev,
      test3: {
        ...prev.test3,
        transcript: "",
        skipped: false,
        micPermission: "unknown",
      },
    }));
  };

  const stopPresageCapture = () => {
    presageControllerRef.current?.stop();
    presageControllerRef.current = null;

    videoStreamRef.current?.getTracks().forEach((track) => track.stop());
    videoStreamRef.current = null;

    if (presageVideoRef.current) {
      presageVideoRef.current.srcObject = null;
    }
  };

  const onPresageSample = (sample: PresageSample) => {
    const samples = [...presageSamplesRef.current, sample];
    presageSamplesRef.current = samples;

    const startedAt = recordingStartedAtRef.current || Date.now();
    setPresageMetrics(derivePresageMetrics(samples, startedAt));

    const hasFace = sample.facePresence >= 0.5;
    if (hasFace) {
      faceLastSeenAtRef.current = sample.timestamp;
      setFaceMissingPrompt(false);
      setFaceMissingSeconds(0);
      faceMissingSecondsRef.current = 0;
      facePromptShownRef.current = false;
      setFacialSignalsStatus((previous) =>
        previous === "unavailable" ? "unavailable" : "available",
      );
      setSessionQuality((previous) => (previous === "unavailable" ? "unavailable" : "good"));
      return;
    }

    const baseline = faceLastSeenAtRef.current ?? recordingStartedAtRef.current ?? sample.timestamp;
    const missingSeconds = Math.max(0, (sample.timestamp - baseline) / 1000);
    faceMissingSecondsRef.current = missingSeconds;
    setFaceMissingSeconds(missingSeconds);

    if (missingSeconds >= faceMissingThresholdSeconds) {
      setFaceMissingPrompt(true);
      if (!facePromptShownRef.current) {
        facePromptShownRef.current = true;
        faceMissingEventsRef.current += 1;
        setFaceMissingEvents(faceMissingEventsRef.current);
      }
      setSessionQuality("limited");
      setFacialSignalsStatus((previous) =>
        previous === "unavailable" ? "unavailable" : "limited",
      );
    }
  };

  const startPresageCapture = async () => {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 } },
      });
      videoStreamRef.current = cameraStream;

      const videoEl = presageVideoRef.current;
      if (!videoEl) {
        throw new Error("Missing video element.");
      }

      videoEl.srcObject = cameraStream;
      await videoEl.play();

      const controller = await startPresageRuntime({
        videoElement: videoEl,
        onSample: onPresageSample,
      });
      presageControllerRef.current = controller;
      setSignalSource(controller.source);
      setFacialSignalsStatus("available");
      setSessionQuality("good");
    } catch {
      setSignalSource("unavailable");
      setFacialSignalsStatus("unavailable");
      setSessionQuality("unavailable");
      setFaceMissingPrompt(false);
      setTest3Status((previous) =>
        previous
          ? `${previous} Camera unavailable, facial signals not captured.`
          : "Camera unavailable, facial signals not captured.",
      );
    }
  };

  const persistAssessmentAttempt = async (payload: AssessmentAttemptPayload) => {
    if (!isAuthenticated) {
      setSaveStatus("Saved locally. Sign in to sync this assessment to the backend.");
      return;
    }

    try {
      const accessToken = await getApiToken();
      const response = await fetch(`${apiBaseUrl}/api/assessment-attempts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await response.text();
      if (!response.ok) {
        throw new Error(body || "Assessment sync failed.");
      }

      setSaveStatus("Assessment synced to backend.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? `Sync failed: ${error.message}` : "Sync failed.");
    }
  };

  useEffect(() => {
    const onBack = () => navigate("/", { replace: true });
    window.history.pushState({}, "", window.location.href);
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [navigate]);

  useEffect(() => {
    return () => {
      stopPresageCapture();
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (step === test3Step) {
      resetStage3Attempt();
    }
  }, [step]);

  useEffect(() => {
    if (!isRecording) return;
    if (repeatRemainingSeconds <= 0) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      return;
    }
    const timer = window.setTimeout(() => {
      setRepeatRemainingSeconds((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [isRecording, repeatRemainingSeconds]);

  useEffect(() => {
    const loadWords = async () => {
      try {
        const response = await fetch("/test0vocab.txt", { cache: "no-store" });
        const text = await response.text();
        const list = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        const test0Words = pickRandomWords(list, 5);
        const test3Words = pickRandomWords(list, 5);
        setAssessmentData((prev) => ({
          ...prev,
          test0Words,
          test3: {
            ...prev.test3,
            promptWords: test3Words,
            promptText: test3Words.join(" "),
          },
        }));
      } catch {
        setAssessmentData((prev) => ({ ...prev, test0Words: [] }));
      }
    };
    void loadWords();
  }, []);

  useEffect(() => {
    if (!isTransitioning) return;
    if (countdown === 0) {
      setStep(nextStep);
      setIsTransitioning(false);
      setHasStarted(true);
      return;
    }
    const t = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, isTransitioning, nextStep]);

  useEffect(() => {
    if (step < test2StepStart || step > test2StepEnd) return;
    setIsFlashVisible(true);
    setFlashCountdown(7);
    if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    flashIntervalRef.current = setInterval(() => {
      setFlashCountdown((v) => {
        if (v <= 1) {
          if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
          flashIntervalRef.current = null;
          setIsFlashVisible(false);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => {
      if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    };
  }, [step]);

  const beginTransition = (targetStep: number) => {
    setNextStep(targetStep);
    setCountdown(3);
    setIsTransitioning(true);
  };

  const drawCanvasScene = (currentStep: number, existingImage?: string) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#111827";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";

    const drawExisting = () => {
      if (!existingImage) return;
      const img = new Image();
      img.onload = () => context.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = existingImage;
    };

    const refImage = drawingReferenceImages[currentStep];
    if (!refImage) {
      drawExisting();
      return;
    }

    const img = new Image();
    img.onload = () => {
      const maxW = 220;
      const maxH = 160;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      context.drawImage(img, 16, 16, img.width * scale, img.height * scale);
      drawExisting();
    };
    img.src = encodeURI(refImage);
  };

  useEffect(() => {
    if (step < drawingStepStart || step > drawingStepEnd) return;
    drawCanvasScene(step, assessmentData.test1Drawings[step]);
  }, [step, assessmentData.test1Drawings]);

  const saveCurrentDrawing = () => {
    if (step < drawingStepStart || step > drawingStepEnd) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setAssessmentData((prev) => ({
      ...prev,
      test1Drawings: { ...prev.test1Drawings, [step]: dataUrl },
    }));
  };

  const clearCurrentDrawing = () => {
    if (step < drawingStepStart || step > drawingStepEnd) return;
    setAssessmentData((prev) => {
      const next = { ...prev.test1Drawings };
      delete next[step];
      return { ...prev, test1Drawings: next };
    });
    drawCanvasScene(step);
  };

  const getMousePosition = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  };

  const handleCanvasMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const { x, y } = getMousePosition(event);
    context.beginPath();
    context.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const handleCanvasMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const { x, y } = getMousePosition(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    saveCurrentDrawing();
  };

  const addPart1Selection = (label: string) => {
    setAssessmentData((prev) => {
      if (prev.test2.part1.selections.length >= 3) return prev;
      if (prev.test2.part1.selections.includes(label)) return prev;
      return {
        ...prev,
        test2: {
          ...prev.test2,
          part1: { ...prev.test2.part1, selections: [...prev.test2.part1.selections, label] },
        },
      };
    });
  };

  const updateEquationAnswer = (value: string) => {
    setAssessmentData((prev) => ({
      ...prev,
      test2: { ...prev.test2, part2: { ...prev.test2.part2, answer: value } },
    }));
  };

  const addColorChoice = (emoji: string) => {
    setAssessmentData((prev) => {
      if (prev.test2.part3.userSequence.length >= 6) return prev;
      return {
        ...prev,
        test2: {
          ...prev.test2,
          part3: { ...prev.test2.part3, userSequence: [...prev.test2.part3.userSequence, emoji] },
        },
      };
    });
  };

  const removeLastColorChoice = () => {
    setAssessmentData((prev) => ({
      ...prev,
      test2: {
        ...prev.test2,
        part3: { ...prev.test2.part3, userSequence: prev.test2.part3.userSequence.slice(0, -1) },
      },
    }));
  };

  const clearColorChoices = () => {
    setAssessmentData((prev) => ({
      ...prev,
      test2: { ...prev.test2, part3: { ...prev.test2.part3, userSequence: [] } },
    }));
  };

  const playTest3Prompt = async () => {
    if (!assessmentData.test3.promptText) return;
    try {
      setTest3Error("");
      setIsPlayingPrompt(true);
      setTest3Phase("listen");
      setTest3Status("Listen phase: playing target words...");
      const response = await fetch("/api/elevenlabs/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: assessmentData.test3.promptText }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "TTS request failed."));
      }
      const payload = (await response.json()) as { audioBase64: string; mimeType: string };
      const audio = new Audio(`data:${payload.mimeType || "audio/mpeg"};base64,${payload.audioBase64}`);
      await audio.play();
      listenPlayedAtRef.current = Date.now();
      setTest3Phase("repeat");
      setTest3Status("Repeat phase ready. Start recording and repeat the words.");
    } catch (error) {
      setTest3Error(error instanceof Error ? error.message : "Unable to play prompt.");
      setTest3Status("Listen phase failed.");
    } finally {
      setIsPlayingPrompt(false);
    }
  };

  const startRecording = async () => {
    setSaveStatus("");
    setTest3Error("");
    setFaceMissingPrompt(false);
    setFaceMissingSeconds(0);
    setFaceMissingEvents(0);
    faceMissingSecondsRef.current = 0;
    faceMissingEventsRef.current = 0;
    faceLastSeenAtRef.current = null;
    facePromptShownRef.current = false;
    presageSamplesRef.current = [];
    setPresageMetrics(null);
    setRepeatRemainingSeconds(stage3RepeatDurationSeconds);

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audioStream;
      setIsRecording(true);
      setTest3Phase("repeat");
      recordingStartedAtRef.current = Date.now();
      recordingStoppedAtRef.current = null;
      setTest3Status("Repeat phase: recording in progress.");
      setAssessmentData((prev) => ({
        ...prev,
        test3: { ...prev.test3, micPermission: "granted", skipped: false },
      }));

      const recorder = new MediaRecorder(audioStream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      void startPresageCapture();

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        recordingStoppedAtRef.current = Date.now();
        setTest3Phase("analyze");
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioStream.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        stopPresageCapture();
        setIsRecording(false);
        try {
          setTest3Status("Analyze phase: transcribing speech...");
          const audioBase64 = await blobToBase64(audioBlob);
          const response = await fetch("/api/elevenlabs/stt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64, mimeType: audioBlob.type || "audio/webm" }),
          });
          if (!response.ok) {
            throw new Error(await getApiErrorMessage(response, "STT request failed."));
          }
          const payload = (await response.json()) as { text: string };
          const transcript = payload.text ?? "";
          const computedRecall = computeRecallMetrics(assessmentData.test3.promptWords, transcript);
          setAssessmentData((prev) => ({
            ...prev,
            test3: { ...prev.test3, transcript },
          }));
          setRecallMetrics(computedRecall);
          setTest3Status("Analyze phase complete.");
          if (facialSignalsStatus === "available" && faceMissingEventsRef.current === 0) {
            setSessionQuality("good");
          }
        } catch (error) {
          setTest3Error(error instanceof Error ? error.message : "Transcription failed.");
          setTest3Status("Analyze phase failed.");
        }
      };

      recorder.start();
    } catch (error) {
      setAssessmentData((prev) => ({
        ...prev,
        test3: {
          ...prev.test3,
          micPermission: "denied",
          skipped: true,
          transcript: "",
        },
      }));
      setFacialSignalsStatus("unavailable");
      setSessionQuality("unavailable");
      setSignalSource("unavailable");
      setTest3Phase("analyze");
      setTest3Error(error instanceof Error ? error.message : "Microphone access denied.");
      setTest3Status("Repeat phase skipped due to microphone denial.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setTest3Status("Analyze phase: processing recording...");
      mediaRecorderRef.current.stop();
    }
  };

  const goNext = () => {
    if (isFlashVisible && step >= test2StepStart && step <= test2StepEnd) {
      setIsFlashVisible(false);
      setFlashCountdown(0);
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
      }
      return;
    }
    if (step === 0) {
      beginTransition(1);
      return;
    }
    if (step === drawingStepEnd) {
      saveCurrentDrawing();
      beginTransition(4);
      return;
    }
    if (step >= drawingStepStart && step <= drawingStepEnd) {
      saveCurrentDrawing();
    }
    if (step < finalStep) setStep((v) => v + 1);
  };

  const buildAssessmentPayload = (): AssessmentAttemptPayload => {
    const selected = assessmentData.test2.part1.selections;
    const expected = assessmentData.test2.part1.objects.map((item) => item.label);
    const correctSelections = selected.filter((label) => expected.includes(label)).length;

    const drawingCompleted = [1, 2, 3].filter(
      (task) => Boolean(assessmentData.test1Drawings[task]),
    ).length;

    const startedAt = recordingStartedAtRef.current ?? Date.now();
    const endedAt = recordingStoppedAtRef.current ?? Date.now();
    const durationSeconds = Math.max(1, (endedAt - startedAt) / 1000);
    const speech = calculateSpeechMetrics(assessmentData.test3.transcript, durationSeconds);
    const finalRecall =
      recallMetrics.totalTargetWords > 0
        ? recallMetrics
        : computeRecallMetrics(assessmentData.test3.promptWords, assessmentData.test3.transcript);

    const finalMetrics =
      presageMetrics ??
      (presageSamplesRef.current.length
        ? derivePresageMetrics(presageSamplesRef.current, startedAt)
        : null);

    return {
      capturedAt: new Date().toISOString(),
      memoryRecall: {
        score: Math.max(0, Math.min(correctSelections, expected.length)),
        maxScore: expected.length,
      },
      drawing: {
        completedTasks: drawingCompleted,
        totalTasks: 3,
        clockTimePrompt: clockInstructionTime,
      },
      speech,
      stage3: {
        targetWords: assessmentData.test3.promptWords,
        recall: finalRecall,
        repeatDurationSeconds: stage3RepeatDurationSeconds,
        phase: test3Phase,
        timestamps: {
          listenPlayedAt: listenPlayedAtRef.current
            ? new Date(listenPlayedAtRef.current).toISOString()
            : null,
          repeatStartedAt: recordingStartedAtRef.current
            ? new Date(recordingStartedAtRef.current).toISOString()
            : null,
          repeatEndedAt: recordingStoppedAtRef.current
            ? new Date(recordingStoppedAtRef.current).toISOString()
            : null,
        },
      },
      presage: {
        facialSignalsStatus,
        sessionQuality,
        source: signalSource,
        faceMissingEvents: faceMissingEventsRef.current,
        faceMissingSeconds: Number(faceMissingSecondsRef.current.toFixed(2)),
        metrics: finalMetrics,
      },
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
    const payload = buildAssessmentPayload();
    await persistAssessmentAttempt(payload);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-14 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl">
        {!hasStarted && !isTransitioning ? (
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Start the assessment</CardTitle>
              <CardDescription>Move section by section through all tests.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => beginTransition(0)}>Begin Form</Button>
            </CardContent>
          </Card>
        ) : isTransitioning ? (
          <Card className="border-border/70">
            <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <p className="text-lg text-muted-foreground">Test {nextTestNumber} beginning in:</p>
              <p className="font-display text-6xl font-semibold text-primary">{countdown}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Test {currentTestNumber}</span>
                <span>{currentTestNumber} / {totalTests - 1}</span>
              </div>
              <Progress value={progressValue} />
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                {step === 0 && (
                  <div className="space-y-2 text-center">
                    <h2 className="font-display text-3xl font-semibold">Test 0: Word Recall</h2>
                    <p className="text-sm text-muted-foreground">Read and remember these words.</p>
                    <ul className="space-y-1 text-lg font-medium">
                      {assessmentData.test0Words.map((word) => (
                        <li key={word}>{word}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {step >= drawingStepStart && step <= drawingStepEnd && (
                  <div className="space-y-4">
                    <h2 className="text-center font-display text-3xl font-semibold">Test 1: Drawing Exercise</h2>
                    <p className="text-center text-sm text-muted-foreground">
                      {drawingInstructions[step as keyof typeof drawingInstructions]}
                    </p>
                    <canvas
                      ref={canvasRef}
                      width={900}
                      height={420}
                      className="w-full cursor-crosshair rounded-md border border-border bg-white"
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                    />
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" onClick={clearCurrentDrawing}>
                        Clear Drawing
                      </Button>
                    </div>
                  </div>
                )}

                {step >= test2StepStart && step <= test2StepEnd && (
                  <div className="space-y-4">
                    <h2 className="text-center font-display text-3xl font-semibold">Test 2: Memory Challenge</h2>
                    {isFlashVisible ? (
                      <div className="rounded-lg border border-border/70 bg-card/60 p-6 text-center">
                        <p className="text-sm text-muted-foreground">Flashing for {flashCountdown}s</p>
                        {step === 4 && <p className="mt-3 text-4xl">{assessmentData.test2.part1.objects.map((x) => x.emoji).join(" ")}</p>}
                        {step === 5 && <p className="mt-3 text-4xl">{equationText}</p>}
                        {step === 6 && <p className="mt-3 text-4xl">{assessmentData.test2.part3.targetSequence.join(" ")}</p>}
                      </div>
                    ) : (
                      <>
                        {step === 4 && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {assessmentData.test2.part1.options.map((item) => (
                                <Button key={item.label} type="button" variant="outline" onClick={() => addPart1Selection(item.label)}>
                                  {item.label}
                                </Button>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Selected: {assessmentData.test2.part1.selections.join(", ")}
                            </p>
                          </div>
                        )}
                        {step === 5 && (
                          <Input
                            value={assessmentData.test2.part2.answer}
                            onChange={(event) => updateEquationAnswer(event.target.value)}
                            placeholder="Your answer"
                          />
                        )}
                        {step === 6 && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {colorEmojiPool.map((emoji) => (
                                <Button key={emoji} type="button" variant="outline" onClick={() => addColorChoice(emoji)}>
                                  <span className="text-xl">{emoji}</span>
                                </Button>
                              ))}
                            </div>
                            <p className="text-2xl">{assessmentData.test2.part3.userSequence.join(" ")}</p>
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" onClick={removeLastColorChoice}>
                                Remove Last
                              </Button>
                              <Button type="button" variant="outline" onClick={clearColorChoices}>
                                Clear
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {step === test3Step && (
                  <div className="space-y-4">
                    <h2 className="text-center font-display text-3xl font-semibold">Test 3: Spoken Recall</h2>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {(["listen", "repeat", "analyze"] as const).map((phase) => (
                        <Badge
                          key={phase}
                          variant="outline"
                          className={
                            test3Phase === phase
                              ? "border-primary/45 bg-primary/15 text-primary"
                              : "border-border/70 bg-card/40 text-muted-foreground"
                          }
                        >
                          {phase[0].toUpperCase()}
                          {phase.slice(1)}
                        </Badge>
                      ))}
                    </div>
                    <div className="rounded-md border border-border/70 bg-card/60 p-3 text-center">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Target Words (Listen and repeat)
                      </p>
                      <p className="mt-2 text-lg font-medium text-foreground">
                        {assessmentData.test3.promptWords.join(" ")}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          sessionQuality === "good"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : sessionQuality === "limited"
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                              : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                        }
                      >
                        Signal Quality: {sessionQuality}
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {signalSource === "presage-sdk" ? "Presage SDK" : signalSource}
                      </Badge>
                      <Badge variant="outline">
                        Timer: {repeatRemainingSeconds}s
                      </Badge>
                    </div>
                    {faceMissingPrompt && (
                      <p className="text-center text-sm text-amber-300">
                        Please face camera. Test continues, but session quality is marked limited.
                      </p>
                    )}
                    {test3Error && (
                      <p className="text-center text-sm text-rose-300">
                        {test3Error}
                      </p>
                    )}
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button type="button" onClick={playTest3Prompt} disabled={isPlayingPrompt || isRecording}>
                        {isPlayingPrompt ? "Playing..." : "1. Listen"}
                      </Button>
                      {!isRecording ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={startRecording}
                          disabled={test3Phase !== "repeat" || isPlayingPrompt}
                        >
                          2. Start Repeat
                        </Button>
                      ) : (
                        <Button type="button" variant="destructive" onClick={stopRecording}>
                          Stop and Analyze
                        </Button>
                      )}
                      <Button type="button" variant="ghost" onClick={resetStage3Attempt} disabled={isRecording}>
                        Retry
                      </Button>
                    </div>
                    {test3Status && <p className="text-center text-sm text-muted-foreground">{test3Status}</p>}
                    <div className="grid gap-2 rounded-md border border-border/70 bg-card/60 p-3 text-sm sm:grid-cols-3">
                      <p className="text-muted-foreground">
                        Facial status:{" "}
                        <span className="font-medium text-foreground">{facialSignalsStatus}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Face-missing events:{" "}
                        <span className="font-medium text-foreground">{faceMissingEvents}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Missing seconds:{" "}
                        <span className="font-medium text-foreground">
                          {faceMissingSeconds.toFixed(1)}
                        </span>
                      </p>
                    </div>
                    <video
                      ref={presageVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="mx-auto h-28 w-44 rounded-md border border-border/60 bg-black/30 object-cover"
                    />
                    <div className="space-y-2">
                      <Label>Captured Transcript</Label>
                      <Input value={assessmentData.test3.transcript} readOnly />
                    </div>
                    <div className="grid gap-2 rounded-md border border-border/70 bg-card/60 p-3 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>
                        Recall matched words:{" "}
                        <span className="text-foreground">
                          {recallMetrics.matchedCount} / {recallMetrics.totalTargetWords}
                        </span>
                      </p>
                      <p>
                        Recall accuracy:{" "}
                        <span className="text-foreground">{(recallMetrics.accuracy * 100).toFixed(1)}%</span>
                      </p>
                      <p className="sm:col-span-2">
                        Matched words:{" "}
                        <span className="text-foreground">
                          {recallMetrics.matchedWords.length
                            ? recallMetrics.matchedWords.join(", ")
                            : "None yet"}
                        </span>
                      </p>
                    </div>
                    {presageMetrics && (
                      <div className="grid gap-2 rounded-md border border-border/70 bg-card/60 p-3 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>
                          Engagement avg/min/max:{" "}
                          <span className="text-foreground">
                            {presageMetrics.engagement.avg} / {presageMetrics.engagement.min} /{" "}
                            {presageMetrics.engagement.max}
                          </span>
                        </p>
                        <p>
                          Blink avg/min/max:{" "}
                          <span className="text-foreground">
                            {presageMetrics.blinkRate.avg} / {presageMetrics.blinkRate.min} /{" "}
                            {presageMetrics.blinkRate.max}
                          </span>
                        </p>
                        <p>
                          Expression avg/min/max:{" "}
                          <span className="text-foreground">
                            {presageMetrics.expressionVariability.avg} /{" "}
                            {presageMetrics.expressionVariability.min} /{" "}
                            {presageMetrics.expressionVariability.max}
                          </span>
                        </p>
                        <p>
                          Face presence avg/min/max:{" "}
                          <span className="text-foreground">
                            {presageMetrics.facePresence.avg} / {presageMetrics.facePresence.min} /{" "}
                            {presageMetrics.facePresence.max}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {isSubmitted && <p className="text-sm text-muted-foreground">Assessment submission captured.</p>}
                {saveStatus && <p className="text-sm text-muted-foreground">{saveStatus}</p>}

                <div className="flex justify-end pt-2">
                  {step < finalStep ? (
                    <Button type="button" onClick={goNext}>
                      Next Section
                    </Button>
                  ) : (
                    <Button type="submit">Submit Assessment</Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Assessment;
