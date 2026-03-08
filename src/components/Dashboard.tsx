import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import type { DoctorDashboardData } from "@/types/presage";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const authAudience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://mnemosyne-api";

const patients = [
  { name: "Eleanor Hayes", id: "PT-1032", risk: "Low", lastCheck: "2 days ago" },
  { name: "Miguel Vance", id: "PT-1067", risk: "Moderate", lastCheck: "4 days ago" },
  { name: "Linda Fox", id: "PT-1084", risk: "High", lastCheck: "Today" },
  { name: "Harold Quinn", id: "PT-1101", risk: "Low", lastCheck: "1 day ago" },
];

const cognitiveTrend = [
  { week: "W1", score: 71 },
  { week: "W2", score: 73 },
  { week: "W3", score: 70 },
  { week: "W4", score: 74 },
  { week: "W5", score: 76 },
  { week: "W6", score: 77 },
];

const speechTrend = [
  { week: "W1", fluency: 58 },
  { week: "W2", fluency: 60 },
  { week: "W3", fluency: 62 },
  { week: "W4", fluency: 61 },
  { week: "W5", fluency: 64 },
  { week: "W6", fluency: 66 },
];

const functionalScore = [
  { name: "Mobility", value: 81 },
  { name: "Daily Tasks", value: 76 },
  { name: "Nutrition", value: 72 },
  { name: "Social", value: 68 },
];

const riskClass: Record<string, string> = {
  Low: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
  Moderate: "bg-amber-400/10 text-amber-300 border-amber-400/25",
  High: "bg-rose-400/10 text-rose-300 border-rose-400/25",
};

const Dashboard = () => {
  const {
    isAuthenticated,
    getAccessTokenSilently,
    getAccessTokenWithPopup,
    isLoading: authLoading,
  } = useAuth0();
  const [doctorData, setDoctorData] = useState<DoctorDashboardData | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

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

    const fetchDoctorDashboard = async () => {
      setDoctorLoading(true);
      setDoctorError("");
      try {
        const token = await getApiToken();
        const response = await fetch(`${apiBaseUrl}/api/doctor/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const raw = await response.text();
        if (!response.ok) {
          throw new Error(raw || "Doctor dashboard request failed.");
        }
        if (!isMounted) return;
        const payload = JSON.parse(raw) as DoctorDashboardData;
        setDoctorData(payload);
      } catch (error) {
        if (!isMounted) return;
        setDoctorError(error instanceof Error ? error.message : "Unable to load doctor data.");
      } finally {
        if (isMounted) setDoctorLoading(false);
      }
    };

    void fetchDoctorDashboard();

    return () => {
      isMounted = false;
    };
  }, [getAccessTokenSilently, getAccessTokenWithPopup, isAuthenticated]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
        className="mb-10 max-w-2xl"
      >
        <p className="mb-2 font-body text-xs uppercase tracking-[0.2em] text-primary">Doctor Dashboard</p>
        <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Patient monitoring and trend analytics
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Behavioral biometrics are monitoring-only signals. They do not provide diagnosis.
        </p>
      </motion.div>

      {isAuthenticated && (doctorLoading || authLoading) && (
        <p className="mb-5 text-sm text-muted-foreground">Loading doctor data...</p>
      )}

      {doctorError && (
        <p className="mb-5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {doctorError}
        </p>
      )}

      {!isAuthenticated && !authLoading && (
        <div className="rounded-2xl border border-border/70 bg-card/75 p-6 text-sm text-muted-foreground">
          Sign in with an authorized doctor account to access this dashboard.
        </div>
      )}

      {isAuthenticated && doctorError && !doctorLoading && !doctorData && (
        <div className="rounded-2xl border border-border/70 bg-card/75 p-6 text-sm text-muted-foreground">
          Doctor dashboard is restricted to authorized doctor-role accounts.
        </div>
      )}

      {isAuthenticated && !doctorLoading && doctorData && (

      <div className="grid gap-6 lg:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45 }}
          className="rounded-2xl border border-border/70 bg-card/75 p-5 lg:col-span-4"
          aria-label="Patient list"
        >
          <h3 className="mb-4 font-display text-xl font-semibold text-foreground">Patient List</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Patient</th>
                  <th className="py-2 pr-3 font-medium">Risk</th>
                  <th className="py-2 font-medium">Last Check</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id} className="border-b border-border/40 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-foreground">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">{patient.id}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${riskClass[patient.risk]}`}
                      >
                        {patient.risk}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">{patient.lastCheck}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        <div className="grid gap-6 lg:col-span-8 md:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="rounded-2xl border border-border/70 bg-card/75 p-5"
            aria-label="Patient cognitive score trends"
          >
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">Cognitive Score Trends</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cognitiveTrend}>
                  <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="rounded-2xl border border-border/70 bg-card/75 p-5"
            aria-label="Patient speech fluency trends"
          >
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">Speech Fluency Trends</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={speechTrend}>
                  <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="fluency"
                    stroke="#7dd3fc"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="rounded-2xl border border-border/70 bg-card/75 p-5 lg:col-span-12"
          aria-label="Functional health score chart"
        >
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">Functional Health Score</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={functionalScore}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="rounded-2xl border border-border/70 bg-card/75 p-5 lg:col-span-7"
          aria-label="Facial engagement trend"
        >
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
            Facial Engagement Trend
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={doctorData?.facialEngagementTrend || []}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 1]} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#a7f3d0"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45, delay: 0.25 }}
          className="rounded-2xl border border-border/70 bg-card/75 p-5 lg:col-span-5"
          aria-label="Session quality and contributing signals"
        >
          <h3 className="mb-3 font-display text-lg font-semibold text-foreground">
            Session Quality
          </h3>
          <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-2 text-center text-emerald-200">
              Good: {doctorData?.sessionQuality.good ?? 0}
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-center text-amber-200">
              Limited: {doctorData?.sessionQuality.limited ?? 0}
            </div>
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-2 text-center text-rose-200">
              Unavailable: {doctorData?.sessionQuality.unavailable ?? 0}
            </div>
          </div>

          <h4 className="mb-2 text-sm font-semibold text-foreground">AI Monitoring Summary</h4>
          <p className="mb-4 text-sm text-muted-foreground">
            {doctorData?.latestSummary || "No AI summary available yet."}
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Source: {doctorData?.summarySource || "heuristic"}
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Confidence: {doctorData?.latestSummaryConfidence ?? 0}
          </p>
          {Boolean(doctorData?.summaryError) && (
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-xs text-amber-200">
              {doctorData?.summaryError}
            </p>
          )}

          {Boolean(doctorData?.possibleDeclineSignals?.length) && (
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold text-foreground">Possible Decline Signals</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {(doctorData?.possibleDeclineSignals || []).slice(0, 4).map((item, index) => (
                  <li key={`decline-signal-${index}`}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

          {Boolean(doctorData?.contributingFactors?.length) && (
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold text-foreground">Contributing Factors</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {(doctorData?.contributingFactors || []).slice(0, 4).map((item, index) => (
                  <li key={`contributing-factor-${index}`}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

          <h4 className="mb-2 text-sm font-semibold text-foreground">Contributing Signals</h4>
          <div className="space-y-2">
            {(doctorData?.contributingSignals || []).slice(0, 4).map((signal) => (
              <div
                key={`${signal.signal}-${signal.direction}`}
                className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground"
              >
                <p className="font-medium text-foreground">
                  {signal.signal}: {signal.direction} ({signal.delta})
                </p>
                <p>{signal.note}</p>
                <p>Confidence: {signal.confidence}</p>
              </div>
            ))}
            {!doctorData?.contributingSignals?.length && (
              <p className="text-xs text-muted-foreground">No contributing signals yet.</p>
            )}
          </div>
        </motion.section>
      </div>
      )}
    </div>
  );
};

export default Dashboard;
