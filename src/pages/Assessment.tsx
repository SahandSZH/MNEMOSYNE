import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { calculateSpeechMetrics } from "@/lib/presageMetrics";
import type { AssessmentAttemptPayload, RecallMetrics } from "@/types/presage";

const totalSteps = 9;
const finalStep = totalSteps - 1;
const totalTests = 5;

const drawingStepStart = 1;
const drawingStepEnd = 3;
const test2StepStart = 4;
const test2StepEnd = 6;
const test3Step = 7;
const test4Step = 8;
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
  if (step === 7) return 3;
  return 4;
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
  const trimmed = text.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
    return parsed.error || parsed.message || trimmed;
  } catch {
    return trimmed;
  }
};

const explainTtsFailure = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("elevenlabs_api_key is missing")) {
    return "Server missing ELEVENLABS_API_KEY in server/.env";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
    return "Cannot reach backend API. Ensure both frontend and API server are running.";
  }
  if (normalized.includes("401") || normalized.includes("403")) {
    return "ElevenLabs key is invalid or lacks permission for this request.";
  }
  if (normalized.includes("429")) {
    return "ElevenLabs rate limit or quota exceeded.";
  }
  if (normalized.includes("voice")) {
    return "Voice ID may be invalid or unavailable.";
  }
  if (normalized.includes("model")) {
    return "Model ID may be invalid or unavailable.";
  }
  if (normalized.includes("text is required")) {
    return "Prompt text is empty.";
  }
  return message;
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
      test4: {
        recalledWords: ["", "", ""] as string[],
      },
    },
  };
};

const Assessment = () => {
  const navigate = useNavigate();
  const { isAuthenticated, getAccessTokenSilently, getAccessTokenWithPopup } = useAuth0();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingStoppedAtRef = useRef<number | null>(null);
  const listenPlayedAtRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const initial = useRef(buildInitialData());
  
  // Timing refs for each test
  const assessmentStartedAtRef = useRef<number | null>(null);
  const assessmentEndedAtRef = useRef<number | null>(null);
  const test0StartRef = useRef<number | null>(null);
  const test0EndRef = useRef<number | null>(null);
  const test1StartRef = useRef<number | null>(null);
  const test1EndRef = useRef<number | null>(null);
  const test2StartRef = useRef<number | null>(null);
  const test2EndRef = useRef<number | null>(null);
  const test3StartRef = useRef<number | null>(null);
  const test3EndRef = useRef<number | null>(null);
  const test4StartRef = useRef<number | null>(null);
  const test4EndRef = useRef<number | null>(null);

  const [step, setStep] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [nextStep, setNextStep] = useState(0);
  const [isFlashVisible, setIsFlashVisible] = useState(false);
  const [flashCountdown, setFlashCountdown] = useState(10);
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

    setSaveStatus("");

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
        const test0Words = pickRandomWords(list, 3);
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
    setFlashCountdown(10);
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
    const now = Date.now();
    
    // Track assessment start
    if (!assessmentStartedAtRef.current && targetStep > 0) {
      assessmentStartedAtRef.current = now;
    }
    
    // Track test endings and beginnings
    const currentTestNum = getTestNumberForStep(step);
    const nextTestNum = getTestNumberForStep(targetStep);
    
    // End previous test
    if (currentTestNum !== nextTestNum && step > 0) {
      if (currentTestNum === 0 && !test0EndRef.current) test0EndRef.current = now;
      if (currentTestNum === 1 && !test1EndRef.current) test1EndRef.current = now;
      if (currentTestNum === 2 && !test2EndRef.current) test2EndRef.current = now;
      if (currentTestNum === 3 && !test3EndRef.current) test3EndRef.current = now;
      if (currentTestNum === 4 && !test4EndRef.current) test4EndRef.current = now;
    }
    
    // Start new test
    if (targetStep > 0) {
      if (nextTestNum === 0 && !test0StartRef.current) test0StartRef.current = now;
      if (nextTestNum === 1 && !test1StartRef.current) test1StartRef.current = now;
      if (nextTestNum === 2 && !test2StartRef.current) test2StartRef.current = now;
      if (nextTestNum === 3 && !test3StartRef.current) test3StartRef.current = now;
      if (nextTestNum === 4 && !test4StartRef.current) test4StartRef.current = now;
    }
    
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

  const updateTest4Word = (index: number, value: string) => {
    setAssessmentData((prev) => {
      const nextWords = [...prev.test4.recalledWords];
      nextWords[index] = value;
      return {
        ...prev,
        test4: {
          ...prev.test4,
          recalledWords: nextWords,
        },
      };
    });
  };

  const clearPart1Selections = () => {
    setAssessmentData((prev) => ({
      ...prev,
      test2: {
        ...prev.test2,
        part1: {
          ...prev.test2.part1,
          selections: [],
        },
      },
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
      const raw = error instanceof Error ? error.message : "Unable to play prompt.";
      const reason = explainTtsFailure(raw);
      setTest3Error(`TTS request failed: ${reason}`);
      setTest3Status(`Listen phase failed: ${reason}`);
    } finally {
      setIsPlayingPrompt(false);
    }
  };

  const startRecording = async () => {
    setSaveStatus("");
    setTest3Error("");
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

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        recordingStoppedAtRef.current = Date.now();
        setTest3Phase("analyze");
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioStream.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
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
    const expected: string[] = assessmentData.test2.part1.objects.map((item) =>
      String(item.label),
    );
    const correctSelections = selected.filter((label) => expected.includes(label)).length;
    const transcriptResponseWords = assessmentData.test3.transcript
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean)
      .slice(0, 5);

    const drawingCompleted = [1, 2, 3].filter(
      (task) => Boolean(assessmentData.test1Drawings[task]),
    ).length;
    const drawingCompletionRatio = drawingCompleted / 3;

    const recordingStartedAt = recordingStartedAtRef.current ?? Date.now();
    const recordingStoppedAt = recordingStoppedAtRef.current ?? Date.now();
    const test3DurationSeconds = Math.max(1, (recordingStoppedAt - recordingStartedAt) / 1000);
    const speech = calculateSpeechMetrics(assessmentData.test3.transcript, test3DurationSeconds);
    const finalRecall =
      recallMetrics.totalTargetWords > 0
        ? recallMetrics
        : computeRecallMetrics(assessmentData.test3.promptWords, assessmentData.test3.transcript);

    // Calculate timing for each test
    const now = Date.now();
    const assessmentStart = assessmentStartedAtRef.current ?? now;
    const assessmentEnd = assessmentEndedAtRef.current ?? now;
    const totalDurationSeconds = Math.max(0, Math.round((assessmentEnd - assessmentStart) / 1000));

    const test0Start = test0StartRef.current ?? assessmentStart;
    const test0End = test0EndRef.current ?? now;
    const test0Seconds = Math.max(0, Math.round((test0End - test0Start) / 1000));

    const test1Start = test1StartRef.current ?? assessmentStart;
    const test1End = test1EndRef.current ?? now;
    const test1Seconds = Math.max(0, Math.round((test1End - test1Start) / 1000));

    const test2Start = test2StartRef.current ?? assessmentStart;
    const test2End = test2EndRef.current ?? now;
    const test2Seconds = Math.max(0, Math.round((test2End - test2Start) / 1000));

    const test3Start = test3StartRef.current ?? assessmentStart;
    const test3End = test3EndRef.current ?? now;
    const test3Seconds = Math.max(0, Math.round((test3End - test3Start) / 1000));

    // Compute stats unique to test2 (memory challenge)
    const test2Part2ExpectedAnswer = String(assessmentData.test2.part2.expectedAnswer).trim();
    const test2Part2UserAnswer = assessmentData.test2.part2.answer.trim();
    const test2Part2IsCorrect = test2Part2ExpectedAnswer && test2Part2UserAnswer 
      ? test2Part2ExpectedAnswer === test2Part2UserAnswer 
      : null;

    const test2Part3TargetSequence = assessmentData.test2.part3.targetSequence.map(v => String(v));
    const test2Part3UserSequence = assessmentData.test2.part3.userSequence.map(v => String(v));
    const test2Part3CorrectCount = Math.min(test2Part3TargetSequence.length, test2Part3UserSequence.length);
    let matchingIndices = 0;
    for (let i = 0; i < test2Part3CorrectCount; i += 1) {
      if (test2Part3TargetSequence[i] === test2Part3UserSequence[i]) {
        matchingIndices += 1;
      }
    }

    // Compute memory recall accuracy
    const memoryAccuracy = expected.length > 0 ? correctSelections / expected.length : 0;

    return {
      capturedAt: new Date().toISOString(),
      tests: {
        test0And4: {
          randomWords: assessmentData.test0Words,
          userInputs: assessmentData.test4.recalledWords,
        },
        test1: {
          clockTimePrompt: clockInstructionTime,
          drawings: {
            step1: assessmentData.test1Drawings[1] ?? null,
            step2: assessmentData.test1Drawings[2] ?? null,
            step3: assessmentData.test1Drawings[3] ?? null,
          },
        },
        test2: {
          part1: {
            randomPrompt: assessmentData.test2.part1.objects.map((item) => item.label),
            userAnswer: assessmentData.test2.part1.selections,
          },
          part2: {
            randomPrompt: equationText,
            expectedAnswer: test2Part2ExpectedAnswer,
            userAnswer: test2Part2UserAnswer,
            isCorrect: test2Part2IsCorrect,
          },
          part3: {
            randomPrompt: assessmentData.test2.part3.targetSequence,
            userAnswer: assessmentData.test2.part3.userSequence,
          },
        },
        test3: {
          chosenWords: assessmentData.test3.promptWords,
          userResponses: transcriptResponseWords,
          transcript: assessmentData.test3.transcript,
        },
      },
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
        facialSignalsStatus: "unavailable",
        sessionQuality: "unavailable",
        source: "unavailable",
        faceMissingEvents: 0,
        faceMissingSeconds: 0,
        metrics: null,
      },
      timing: {
        assessmentStartedAt: assessmentStart ? new Date(assessmentStart).toISOString() : null,
        assessmentEndedAt: assessmentEnd ? new Date(assessmentEnd).toISOString() : null,
        totalDurationSeconds,
        tests: {
          test0Seconds,
          test1Seconds,
          test2Seconds,
          test3Seconds: Math.round(test3DurationSeconds),
        },
      },
      testData: {
        test0Words: assessmentData.test0Words,
        test1Drawings: assessmentData.test1Drawings,
        test2: {
          part1: {
            objects: assessmentData.test2.part1.objects,
            options: assessmentData.test2.part1.options,
            selections: assessmentData.test2.part1.selections,
          },
          part2: {
            expectedAnswer: test2Part2ExpectedAnswer,
            answer: test2Part2UserAnswer,
            isCorrect: test2Part2IsCorrect,
          },
          part3: {
            targetSequence: assessmentData.test2.part3.targetSequence,
            userSequence: assessmentData.test2.part3.userSequence,
          },
        },
        test3: {
          promptWords: assessmentData.test3.promptWords,
          promptText: assessmentData.test3.promptText,
          skipped: assessmentData.test3.skipped,
          micPermission: assessmentData.test3.micPermission,
        },
      },
    };
  };

  const handleFinalSubmit = async () => {
    if (step !== finalStep) return;
    assessmentEndedAtRef.current = Date.now();
    setIsSubmitted(true);
    const payload = buildAssessmentPayload();
    await persistAssessmentAttempt(payload);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background px-4 py-14 text-foreground sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Card className="border-border/70">
            <CardContent className="flex min-h-64 items-center justify-center text-center">
              <p className="text-xl font-medium">Thank you for completing the assessment.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
              <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
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
                        {step === 4 && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Memorize the 3 objects in order, then select the matching 3 labels.
                          </p>
                        )}
                        {step === 5 && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Memorize the equation, then enter the final numeric answer.
                          </p>
                        )}
                        {step === 6 && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Memorize the 6-color sequence, then recreate it with the color buttons.
                          </p>
                        )}
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
                                <Button
                                  key={item.label}
                                  type="button"
                                  variant={assessmentData.test2.part1.selections.includes(item.label) ? "default" : "outline"}
                                  onClick={() => addPart1Selection(item.label)}
                                >
                                  {item.label}
                                </Button>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Selected: {assessmentData.test2.part1.selections.join(", ")}
                            </p>
                            <div className="flex justify-end">
                              <Button type="button" variant="outline" onClick={clearPart1Selections}>
                                Clear Selections
                              </Button>
                            </div>
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
                    <div className="flex items-center justify-center gap-2">
                      <Badge variant="outline">
                        Timer: {repeatRemainingSeconds}s
                      </Badge>
                    </div>
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
                    <div className="space-y-2">
                      <Label>Captured Transcript</Label>
                      <Input value={assessmentData.test3.transcript} readOnly />
                    </div>
                  </div>
                )}

                {step === test4Step && (
                  <div className="space-y-4">
                    <h2 className="text-center font-display text-3xl font-semibold">Test 4: Word Recall Check</h2>
                    <p className="text-center text-sm text-muted-foreground">
                      Enter the 3 words shown at the beginning of Test 0.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {assessmentData.test4.recalledWords.map((word, index) => (
                        <Input
                          key={`test4-word-${index + 1}`}
                          value={word}
                          onChange={(event) => updateTest4Word(index, event.target.value)}
                          placeholder={`Word ${index + 1}`}
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {saveStatus && <p className="text-sm text-muted-foreground">{saveStatus}</p>}

                <div className="flex justify-end pt-2">
                  {step < finalStep ? (
                    <Button type="button" onClick={goNext}>
                      Next Section
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleFinalSubmit}>Submit Assessment</Button>
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
