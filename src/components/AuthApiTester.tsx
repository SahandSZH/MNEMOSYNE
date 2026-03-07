import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth0 } from "@auth0/auth0-react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const authAudience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://mnemosyne-api";

function formatError(status: number, body: string) {
  if (status === 401) return `401 Unauthorized: ${body}`;
  if (status === 403) return `403 Forbidden: ${body}`;
  return `${status}: ${body}`;
}

const AuthApiTester = () => {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    getAccessTokenSilently,
    getAccessTokenWithPopup,
  } = useAuth0();
  const [meResult, setMeResult] = useState("");
  const [doctorResult, setDoctorResult] = useState("");
  const [error, setError] = useState("");

  const getApiToken = async () => {
    try {
      return await getAccessTokenSilently({
        authorizationParams: { audience: authAudience },
      });
    } catch (err) {
      const code = typeof err === "object" && err ? (err as { error?: string }).error : "";
      if (code === "consent_required" || code === "login_required") {
        return getAccessTokenWithPopup({
          authorizationParams: { audience: authAudience },
        });
      }
      throw err;
    }
  };

  const callProtectedApi = async (path: "/api/me" | "/api/doctor-only") => {
    setError("");
    try {
      const accessToken = await getApiToken();

      const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(formatError(response.status, raw));
      }

      const pretty = JSON.stringify(JSON.parse(raw), null, 2);
      if (path === "/api/me") {
        setMeResult(pretty);
      } else {
        setDoctorResult(pretty);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown API error");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
        className="mb-8 max-w-2xl"
      >
        <p className="mb-2 font-body text-xs uppercase tracking-[0.2em] text-primary">Auth API Test</p>
        <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Frontend and backend token integration check
        </h2>
      </motion.div>

      <div className="rounded-2xl border border-border/70 bg-card/75 p-6 sm:p-8">
        {!isAuthenticated ? (
          <button
            type="button"
            onClick={() =>
              loginWithRedirect({ authorizationParams: { audience: authAudience } })
            }
            disabled={isLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            Sign In to Test API
          </button>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => callProtectedApi("/api/me")}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            >
              Test /api/me
            </button>
            <button
              type="button"
              onClick={() => callProtectedApi("/api/doctor-only")}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            >
              Test /api/doctor-only
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {meResult && (
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">/api/me response</p>
            <pre className="overflow-x-auto rounded-md border border-border/70 bg-background/60 p-3 text-xs text-foreground">
              {meResult}
            </pre>
          </div>
        )}

        {doctorResult && (
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              /api/doctor-only response
            </p>
            <pre className="overflow-x-auto rounded-md border border-border/70 bg-background/60 p-3 text-xs text-foreground">
              {doctorResult}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthApiTester;
