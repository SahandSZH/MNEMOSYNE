import cors from "cors";
import express from "express";

import { checkJwt, getRoles, requireDoctor } from "./auth.js";
import { config } from "./config.js";
import { registerElevenLabsRoutes } from "./elevenlabs.js";

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
