import cors from "cors";
import express from "express";

import { checkJwt, getRoles, requireDoctor } from "./auth.js";
import { buildAiSummary, buildGeminiInputContract } from "./dashboardAnalysis.js";
import { config } from "./config.js";
import { healthCheckDatabase } from "./db.js";
import { getDoctorDashboardData } from "./doctorDashboardStore.js";
import { scoreDrawingsForAssessment } from "./drawingScoringService.js";
import { registerElevenLabsRoutes } from "./elevenlabs.js";
import { generateGeminiMonitoringReport } from "./geminiService.js";
import {
  backfillAssessmentDerivedTables,
  getPatientAssessmentHistory,
  saveAssessmentAiReport,
  saveAssessmentAttempt,
  syncAuth0UserProfile,
} from "./assessmentStore.js";
import { runMigrations } from "./migrations.js";

const app = express();

app.use(express.json({ limit: "25mb" }));
app.use(
  cors({
    origin: config.clientOrigin,
  }),
);

app.get("/health", async (_req, res) => {
  try {
    await healthCheckDatabase();
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(503).json({
      status: "degraded",
      database: "unavailable",
      message: error instanceof Error ? error.message : "Database unavailable",
    });
  }
});

registerElevenLabsRoutes(app);

app.get("/api/me", checkJwt, (req, res) => {
  const payload = req.auth?.payload || {};
  res.json({
    sub: payload.sub || "",
    email: payload.email || "",
    name: payload.name || "",
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

app.post("/api/users/sync", checkJwt, async (req, res, next) => {
  try {
    const tokenPayload = req.auth?.payload || {};
    const tokenSub = String(tokenPayload.sub || "");
    if (!tokenSub) {
      return res.status(400).json({
        error: "invalid_token_payload",
        message: "Missing Auth0 subject (sub).",
      });
    }

    const body = req.body || {};
    const profile = {
      sub: tokenSub,
      user_id: tokenSub,
      email:
        typeof body.email === "string" && body.email.trim()
          ? body.email.trim()
          : String(tokenPayload.email || ""),
      name:
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : String(tokenPayload.name || ""),
      picture:
        typeof body.picture === "string" && body.picture.trim()
          ? body.picture.trim()
          : String(tokenPayload.picture || ""),
      source: "frontend-auth-sync",
    };

    const user = await syncAuth0UserProfile(profile);
    return res.status(200).json({
      saved: true,
      user,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/assessment-attempts", checkJwt, async (req, res, next) => {
  try {
    const tokenPayload = req.auth?.payload || {};
    const patientSub = String(tokenPayload.sub || "").trim();
    if (!patientSub) {
      return res.status(400).json({
        error: "invalid_token_payload",
        message: "Missing Auth0 subject (sub).",
      });
    }

    const patientEmail = String(tokenPayload.email || "").trim();
    const patientName = String(tokenPayload.name || "").trim();

    const attemptInput = {
      ...req.body,
      patientSub,
      patientEmail,
      patientName,
    };

    const savedAttempt = await saveAssessmentAttempt(attemptInput);
    const savedAssessmentId = Number(savedAttempt?.assessmentId);
    if (Number.isInteger(savedAssessmentId) && savedAssessmentId > 0) {
      void scoreDrawingsForAssessment(savedAssessmentId).catch((error) => {
        console.error(
          `Auto drawing scoring failed for assessment ${savedAssessmentId}:`,
          error instanceof Error ? error.message : error,
        );
      });
    }

    const patientHistory = await getPatientAssessmentHistory(patientSub);
    const historyWithoutLatest = patientHistory.slice(0, -1);
    const heuristicSummary = buildAiSummary(savedAttempt, historyWithoutLatest);
    const geminiInputContract = buildGeminiInputContract(savedAttempt, historyWithoutLatest);
    const geminiReport = await generateGeminiMonitoringReport({
      geminiInputContract,
      fallbackSummary: heuristicSummary,
    });

    await saveAssessmentAiReport(savedAttempt.attemptId, geminiReport);

    const aiSummary = {
      summaryText: geminiReport.clinicalSummary,
      summaryConfidence: geminiReport.confidence,
      contributingSignals: heuristicSummary.contributingSignals,
      possibleDeclineSignals: geminiReport.possibleDeclineSignals,
      contributingFactors: geminiReport.contributingFactors,
      source: geminiReport.source,
      error: geminiReport.error,
    };

    return res.status(201).json({
      saved: true,
      attemptId: savedAttempt.attemptId || savedAttempt.id,
      aiSummary,
      geminiInputContract,
      aiReport: geminiReport,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/assessment-attempts/me", checkJwt, async (req, res, next) => {
  try {
    const payload = req.auth?.payload || {};
    const patientSub = String(payload.sub || "");
    const attempts = await getPatientAssessmentHistory(patientSub);
    return res.json({ attempts });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/doctor/dashboard", checkJwt, requireDoctor, async (_req, res, next) => {
  try {
    const dashboard = await getDoctorDashboardData();
    return res.json(dashboard);
  } catch (error) {
    return next(error);
  }
});

app.post("/api/assessment/:id/score-drawings", checkJwt, requireDoctor, async (req, res, next) => {
  try {
    const result = await scoreDrawingsForAssessment(req.params.id);
    const statusCode =
      result.scoringStatus === "success" ? 200 : result.scoringStatus === "fallback" ? 200 : 502;
    return res.status(statusCode).json(result);
  } catch (error) {
    return next(error);
  }
});

app.use((err, _req, res, _next) => {
  const status = err?.status || 500;
  const message = err?.message || "Internal server error";
  res.status(status).json({
    error: status >= 500 ? "server_error" : "request_error",
    message,
  });
});

async function startServer() {
  await runMigrations();
  const { backfilledCount } = await backfillAssessmentDerivedTables();
  if (backfilledCount > 0) {
    console.log(`Backfilled ${backfilledCount} assessment(s) into derived test tables.`);
  }

  app.listen(config.port, () => {
    console.log(`API server running at http://localhost:${config.port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start API server", error);
  process.exit(1);
});
