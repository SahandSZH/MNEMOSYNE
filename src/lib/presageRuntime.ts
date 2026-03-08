import type { PresageSample, PresageSignalSource } from "@/types/presage";

type RuntimeSample = Record<string, unknown>;

export interface PresageRuntimeController {
  source: PresageSignalSource;
  stop: () => void;
}

interface StartPresageOptions {
  videoElement: HTMLVideoElement;
  onSample: (sample: PresageSample) => void;
}

interface PresageSdkSession {
  stop?: () => void;
}

interface PresageSdkGlobal {
  startBehavioralSession?: (options: {
    video: HTMLVideoElement;
    apiKey?: string;
    onUpdate: (sample: RuntimeSample) => void;
  }) => Promise<PresageSdkSession> | PresageSdkSession;
}

declare global {
  interface Window {
    Presage?: PresageSdkGlobal;
  }
}

const numberOr = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toSample = (value: RuntimeSample): PresageSample => ({
  timestamp: Date.now(),
  facePresence: numberOr(value.facePresence ?? value.face_presence, 0),
  engagement: numberOr(value.engagement ?? value.focus, 0),
  blinkRate: numberOr(value.blinkRate ?? value.blink_rate, 0),
  expressionVariability: numberOr(
    value.expressionVariability ?? value.expression_variability,
    0,
  ),
});

const startMockSampling = (onSample: (sample: PresageSample) => void): PresageRuntimeController => {
  const startedAt = Date.now();
  const interval = window.setInterval(() => {
    const elapsed = (Date.now() - startedAt) / 1000;
    onSample({
      timestamp: Date.now(),
      facePresence: Math.max(0, Math.min(1, 0.86 + 0.11 * Math.sin(elapsed / 7))),
      engagement: Math.max(0, Math.min(1, 0.62 + 0.2 * Math.sin(elapsed / 5))),
      blinkRate: Math.max(6, 14 + 3 * Math.cos(elapsed / 4)),
      expressionVariability: Math.max(0, Math.min(1, 0.42 + 0.2 * Math.sin(elapsed / 3))),
    });
  }, 1000);

  return {
    source: "mock",
    stop: () => window.clearInterval(interval),
  };
};

export const startPresageRuntime = async ({
  videoElement,
  onSample,
}: StartPresageOptions): Promise<PresageRuntimeController> => {
  const presageApiKey = import.meta.env.VITE_PRESAGE_API_KEY;
  const sdk = window.Presage;
  if (sdk?.startBehavioralSession) {
    const session = await sdk.startBehavioralSession({
      video: videoElement,
      apiKey: presageApiKey,
      onUpdate: (sample) => onSample(toSample(sample)),
    });

    return {
      source: "presage-sdk",
      stop: () => {
        session?.stop?.();
      },
    };
  }

  const allowMock = import.meta.env.VITE_PRESAGE_DEV_MOCK !== "false";
  if (allowMock) {
    return startMockSampling(onSample);
  }

  throw new Error("Presage SDK unavailable.");
};
