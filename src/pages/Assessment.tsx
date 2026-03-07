import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const totalSteps = 8;
const finalStep = totalSteps - 1;
const totalTests = 4;

const drawingStepStart = 1;
const drawingStepEnd = 3;
const test2StepStart = 4;
const test2StepEnd = 6;
const test3Step = 7;

const drawingReferenceImages: Partial<Record<number, string>> = {
  2: "/Conjoined pentagons.png",
  3: "/Cube.png",
};
const drawingInstructions = {
  1: "Draw an analog clock at time: 10:10",
  2: "Copy the conjoined pentagons shown in the top-left.",
  3: "Copy the cube shown in the top-left.",
} as const;

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
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

  const progressValue = useMemo(() => ((step + 1) / totalSteps) * 100, [step]);
  const currentTestNumber = useMemo(() => getTestNumberForStep(step), [step]);
  const nextTestNumber = useMemo(() => getTestNumberForStep(nextStep), [nextStep]);

  useEffect(() => {
    const onBack = () => navigate("/", { replace: true });
    window.history.pushState({}, "", window.location.href);
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [navigate]);

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
      setIsPlayingPrompt(true);
      setTest3Status("Playing prompt...");
      const response = await fetch("/api/elevenlabs/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: assessmentData.test3.promptText }),
      });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { audioBase64: string; mimeType: string };
      const audio = new Audio(`data:${payload.mimeType || "audio/mpeg"};base64,${payload.audioBase64}`);
      await audio.play();
      setTest3Status("Prompt played.");
    } catch {
      setTest3Status("TTS failed.");
    } finally {
      setIsPlayingPrompt(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setIsRecording(true);
      setAssessmentData((prev) => ({
        ...prev,
        test3: { ...prev.test3, micPermission: "granted", skipped: false },
      }));
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        try {
          setTest3Status("Transcribing...");
          const audioBase64 = await blobToBase64(audioBlob);
          const response = await fetch("/api/elevenlabs/stt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64, mimeType: audioBlob.type || "audio/webm" }),
          });
          if (!response.ok) throw new Error();
          const payload = (await response.json()) as { text: string };
          setAssessmentData((prev) => ({
            ...prev,
            test3: { ...prev.test3, transcript: payload.text ?? "" },
          }));
          setTest3Status("Transcription complete.");
        } catch {
          setTest3Status("STT failed.");
        }
      };

      recorder.start();
    } catch {
      setAssessmentData((prev) => ({
        ...prev,
        test3: {
          ...prev.test3,
          micPermission: "denied",
          skipped: true,
          transcript: prev.test3.promptText,
        },
      }));
      setTest3Status("Microphone denied. Test skipped.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
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
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button type="button" onClick={playTest3Prompt} disabled={isPlayingPrompt}>
                        {isPlayingPrompt ? "Playing..." : "Play Phrase"}
                      </Button>
                      {!isRecording ? (
                        <Button type="button" variant="outline" onClick={startRecording}>
                          Start Recording
                        </Button>
                      ) : (
                        <Button type="button" variant="destructive" onClick={stopRecording}>
                          Stop Recording
                        </Button>
                      )}
                    </div>
                    {test3Status && <p className="text-center text-sm text-muted-foreground">{test3Status}</p>}
                    <div className="space-y-2">
                      <Label>Captured Transcript</Label>
                      <Input value={assessmentData.test3.transcript} readOnly />
                    </div>
                  </div>
                )}

                {isSubmitted && <p className="text-sm text-muted-foreground">Assessment captured locally.</p>}

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
