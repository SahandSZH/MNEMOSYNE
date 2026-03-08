import cors from "cors";
import express from "express";

import { checkJwt, getRoles, requireDoctor } from "./auth.js";
import { buildAiSummary, buildDoctorDashboardData, buildGeminiInputContract } from "./dashboardAnalysis.js";
import { config } from "./config.js";
import { registerElevenLabsRoutes } from "./elevenlabs.js";
import { getAllAssessmentAttempts, getPatientAssessmentHistory, saveAssessmentAttempt } from "./assessmentStore.js";

const app = express();

app.use(express.json({ limit: "25mb" }));
app.use(
  cors({
    origin: config.clientOrigin,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

registerElevenLabsRoutes(app);

app.get("/api/me", checkJwt, (req, res) => {
  const payload = req.auth?.payload || {};
  res.json({
    sub: payload.sub || "",
    email: payload.email || "",
    roles: getRoles(payload),
  });
});

app.get("/api/doctor-only", checkJwt, requireDoctor, (req, res) => {
  const payload = req.auth?.payload || {};
  res.json({
    message: "Doctor endpoint access granted.",
    sub: payload.sub || "",
    roles: getRoles(payload),
  });
});

app.post("/api/assessment-attempts", checkJwt, (req, res) => {
  const payload = req.auth?.payload || {};
  const patientSub = String(payload.sub || "unknown");
  const patientEmail = String(payload.email || "");
  const capturedAt = String(req.body?.capturedAt || new Date().toISOString());

  const memoryRecall = {
    score: Number(req.body?.memoryRecall?.score || 0),
    maxScore: Number(req.body?.memoryRecall?.maxScore || 0),
  };

  const drawing = {
    completedTasks: Number(req.body?.drawing?.completedTasks || 0),
    totalTasks: Number(req.body?.drawing?.totalTasks || 0),
    clockTimePrompt: String(req.body?.drawing?.clockTimePrompt || ""),
  };

  const speech = {
    transcript: String(req.body?.speech?.transcript || ""),
    wordCount: Number(req.body?.speech?.wordCount || 0),
    speechRateWpm: Number(req.body?.speech?.speechRateWpm || 0),
    vocabularyDiversity: Number(req.body?.speech?.vocabularyDiversity || 0),
  };

  const stage3 = {
    targetWords: Array.isArray(req.body?.stage3?.targetWords)
      ? req.body.stage3.targetWords.map((word) => String(word))
      : [],
    recall: {
      matchedCount: Number(req.body?.stage3?.recall?.matchedCount || 0),
      totalTargetWords: Number(req.body?.stage3?.recall?.totalTargetWords || 0),
      accuracy: Number(req.body?.stage3?.recall?.accuracy || 0),
      matchedWords: Array.isArray(req.body?.stage3?.recall?.matchedWords)
        ? req.body.stage3.recall.matchedWords.map((word) => String(word))
        : [],
    },
    repeatDurationSeconds: Number(req.body?.stage3?.repeatDurationSeconds || 0),
    phase: String(req.body?.stage3?.phase || "listen"),
    timestamps: {
      listenPlayedAt: req.body?.stage3?.timestamps?.listenPlayedAt
        ? String(req.body.stage3.timestamps.listenPlayedAt)
        : null,
      repeatStartedAt: req.body?.stage3?.timestamps?.repeatStartedAt
        ? String(req.body.stage3.timestamps.repeatStartedAt)
        : null,
      repeatEndedAt: req.body?.stage3?.timestamps?.repeatEndedAt
        ? String(req.body.stage3.timestamps.repeatEndedAt)
        : null,
    },
  };

  const presage = {
    facialSignalsStatus: String(req.body?.presage?.facialSignalsStatus || "unknown"),
    sessionQuality: String(req.body?.presage?.sessionQuality || "unavailable"),
    source: String(req.body?.presage?.source || "unavailable"),
    faceMissingEvents: Number(req.body?.presage?.faceMissingEvents || 0),
    faceMissingSeconds: Number(req.body?.presage?.faceMissingSeconds || 0),
    metrics: req.body?.presage?.metrics || null,
  };

  const attempt = {
    id: `attempt-${Date.now()}`,
    patientSub,
    patientEmail,
    capturedAt,
    memoryRecall,
    drawing,
    speech,
    stage3,
    presage,
  };

  saveAssessmentAttempt(attempt);

  const patientHistory = getPatientAssessmentHistory(patientSub);
  const historyWithoutLatest = patientHistory.slice(0, -1);
  const aiSummary = buildAiSummary(attempt, historyWithoutLatest);
  const geminiInputContract = buildGeminiInputContract(attempt, historyWithoutLatest);

  res.status(201).json({
    saved: true,
    attemptId: attempt.id,
    aiSummary,
    geminiInputContract,
  });
});

app.get("/api/doctor/dashboard", checkJwt, requireDoctor, (_req, res) => {
  const allAttempts = getAllAssessmentAttempts();
  const dashboard = buildDoctorDashboardData(allAttempts);
  res.json(dashboard);
});

app.use((err, _req, res, _next) => {
  const status = err?.status || 401;
  const message = err?.message || "Unauthorized";
  res.status(status).json({
    error: "unauthorized",
    message,
  });
});

app.listen(config.port, () => {
  console.log(`API server running at http://localhost:${config.port}`);
});
