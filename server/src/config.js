import "dotenv/config";

const toNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const config = {
  port: Number(process.env.PORT || 8787),
  auth0Domain: process.env.AUTH0_DOMAIN || "dev-l52y223ttoigljdr.us.auth0.com",
  auth0Audience: process.env.AUTH0_AUDIENCE || "https://mnemosyne-api",
  auth0RolesNamespace: process.env.AUTH0_ROLES_NAMESPACE || "https://mnemosyne.app",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:8080",
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSslMode: process.env.DATABASE_SSL_MODE || "require",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 15000),
  geminiEnabled: String(process.env.GEMINI_ENABLED || "true").toLowerCase() !== "false",
  backboardApiKey: process.env.BACKBOARD_API_KEY || "",
  backboardApiUrl:
    process.env.BACKBOARD_API_URL || "https://api.backboard.io/v1/chat/completions",
  backboardModel: process.env.BACKBOARD_MODEL || "google/gemini-2.0-flash",
  backboardEnabled: String(process.env.BACKBOARD_ENABLED || "true").toLowerCase() !== "false",
  deepAnalysisTimeoutMs: Math.max(
    1000,
    toNumber(process.env.DEEP_ANALYSIS_TIMEOUT_MS, toNumber(process.env.GEMINI_TIMEOUT_MS, 15000)),
  ),
  deepAnalysisMaxRetries: Math.max(
    0,
    Math.floor(toNumber(process.env.DEEP_ANALYSIS_MAX_RETRIES, 1)),
  ),
  geminiDrawingTimeoutMs: Math.max(
    1000,
    toNumber(process.env.GEMINI_DRAWING_TIMEOUT_MS, toNumber(process.env.GEMINI_TIMEOUT_MS, 15000)),
  ),
  geminiDrawingMaxRetries: Math.max(0, Math.floor(toNumber(process.env.GEMINI_DRAWING_MAX_RETRIES, 1))),
};
