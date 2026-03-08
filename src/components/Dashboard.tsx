import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Filter,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DoctorTestCatalog from "@/components/DoctorTestCatalog";
import type {
  DoctorDeepAnalysisResponse,
  DoctorDeepAnalysisUiState,
  DoctorDashboardActivity,
  DoctorDashboardData,
  DoctorDashboardPatient,
  DoctorDashboardPriorityItem,
  DoctorRiskLevel,
} from "@/types/presage";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const authAudience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://mnemosyne-api";

type SortMode = "risk" | "latest" | "recall" | "speech" | "memory";

const riskWeight: Record<DoctorRiskLevel, number> = {
  Low: 1,
  Moderate: 2,
  High: 3,
};

const riskStyle: Record<DoctorRiskLevel, string> = {
  Low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  Moderate: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  High: "border-rose-500/35 bg-rose-500/15 text-rose-200",
};

const formatShortDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatRelativeTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  const now = Date.now();
  const diffHours = Math.max(1, Math.floor((now - parsed.getTime()) / (1000 * 60 * 60)));

  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatShortDate(value);
};

const parseApiError = async (response: Response) => {
  const text = await response.text();
  if (!text) return "Doctor dashboard request failed.";
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    return parsed.message || parsed.error || text;
  } catch {
    return text;
  }
};

const initialDeepAnalysisState = (): DoctorDeepAnalysisUiState => ({
  status: "idle",
  response: null,
  error: "",
});

const Dashboard = () => {
  const {
    isAuthenticated,
    isLoading: authLoading,
    user,
    getAccessTokenSilently,
    getAccessTokenWithPopup,
  } = useAuth0();

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | DoctorRiskLevel>("all");
  const [sortBy, setSortBy] = useState<SortMode>("risk");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [dashboardData, setDashboardData] = useState<DoctorDashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [deepAnalysis, setDeepAnalysis] = useState<DoctorDeepAnalysisUiState>(initialDeepAnalysisState);

  const userRoles = useMemo(() => {
    const claims = user as Record<string, unknown> | undefined;
    const namespaced = claims?.["https://mnemosyne.app/roles"];
    if (Array.isArray(namespaced)) {
      return namespaced.filter((value): value is string => typeof value === "string");
    }
    const plain = claims?.roles;
    if (Array.isArray(plain)) {
      return plain.filter((value): value is string => typeof value === "string");
    }
    return [];
  }, [user]);

  const isDoctorUser = userRoles.some((role) => role.toLowerCase() === "doctor");

  const getApiToken = useCallback(async () => {
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
  }, [getAccessTokenSilently, getAccessTokenWithPopup]);

  useEffect(() => {
    if (!isAuthenticated || !isDoctorUser) {
      setDashboardData(null);
      setDashboardError("");
      setDashboardLoading(false);
      return;
    }

    let isMounted = true;

    const fetchDashboard = async () => {
      setDashboardLoading(true);
      setDashboardError("");

      try {
        const token = await getApiToken();
        const response = await fetch(`${apiBaseUrl}/api/doctor/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(await parseApiError(response));
        }

        const payload = (await response.json()) as DoctorDashboardData;

        if (!isMounted) return;
        setDashboardData(payload);
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "Unable to load dashboard data.";
        if (message.toLowerCase().includes("failed to fetch")) {
          setDashboardError(
            "Doctor dashboard API is unreachable. Start the backend (`npm run dev:api`) and verify VITE_API_BASE_URL.",
          );
        } else {
          setDashboardError(message);
        }
      } finally {
        if (isMounted) setDashboardLoading(false);
      }
    };

    void fetchDashboard();

    return () => {
      isMounted = false;
    };
  }, [getApiToken, isAuthenticated, isDoctorUser]);

  const patients = dashboardData?.patients ?? [];

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = patients.filter((patient) => {
      const matchRisk = riskFilter === "all" || patient.risk === riskFilter;
      const matchQuery =
        !query ||
        patient.name.toLowerCase().includes(query) ||
        patient.code.toLowerCase().includes(query);
      return matchRisk && matchQuery;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "latest":
          return new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime();
        case "recall":
          return b.recallScore - a.recallScore;
        case "speech":
          return b.speechScore - a.speechScore;
        case "memory":
          return b.memoryScore - a.memoryScore;
        case "risk":
        default:
          return riskWeight[b.risk] - riskWeight[a.risk];
      }
    });
  }, [patients, riskFilter, search, sortBy]);

  useEffect(() => {
    if (!filteredPatients.length) {
      setSelectedPatientId("");
      return;
    }

    const exists = filteredPatients.some((patient) => patient.id === selectedPatientId);
    if (!exists) {
      setSelectedPatientId(filteredPatients[0].id);
    }
  }, [filteredPatients, selectedPatientId]);

  const selectedPatient: DoctorDashboardPatient | null =
    filteredPatients.find((patient) => patient.id === selectedPatientId) ?? null;

  useEffect(() => {
    if (!isAuthenticated || !isDoctorUser || !selectedPatientId) {
      setDeepAnalysis(initialDeepAnalysisState());
      return;
    }

    let isMounted = true;
    setDeepAnalysis({
      status: "loading",
      response: null,
      error: "",
    });

    const loadLatestDeepAnalysis = async () => {
      try {
        const token = await getApiToken();
        const response = await fetch(
          `${apiBaseUrl}/api/doctor/patients/${encodeURIComponent(selectedPatientId)}/deep-analysis/latest`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.status === 404) {
          if (isMounted) {
            setDeepAnalysis(initialDeepAnalysisState());
          }
          return;
        }

        if (!response.ok) {
          throw new Error(await parseApiError(response));
        }

        const payload = (await response.json()) as DoctorDeepAnalysisResponse;
        if (!isMounted) return;
        setDeepAnalysis({
          status: "success",
          response: payload,
          error: "",
        });
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof Error ? error.message : "Unable to load latest deep analysis report.";
        setDeepAnalysis({
          status: "error",
          response: null,
          error: message,
        });
      }
    };

    void loadLatestDeepAnalysis();

    return () => {
      isMounted = false;
    };
  }, [getApiToken, isAuthenticated, isDoctorUser, selectedPatientId]);

  const runDeepAnalysis = useCallback(
    async (patientId: string) => {
      const normalizedPatientId = String(patientId || "").trim();
      if (!normalizedPatientId) return;

      setDeepAnalysis({
        status: "loading",
        response: null,
        error: "",
      });

      try {
        const token = await getApiToken();
        const response = await fetch(
          `${apiBaseUrl}/api/doctor/patients/${encodeURIComponent(normalizedPatientId)}/deep-analysis`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(await parseApiError(response));
        }

        const payload = (await response.json()) as DoctorDeepAnalysisResponse;
        setDeepAnalysis({
          status: "success",
          response: payload,
          error: "",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to run deep analysis.";
        setDeepAnalysis({
          status: "error",
          response: null,
          error: message,
        });
      }
    },
    [getApiToken],
  );

  const priorityQueue = useMemo(() => {
    const queue = dashboardData?.priorityQueue ?? [];
    if (riskFilter === "all" && !search.trim()) return queue;

    const query = search.trim().toLowerCase();
    return queue.filter((item) => {
      const matchRisk = riskFilter === "all" || item.risk === riskFilter;
      const matchQuery =
        !query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query);
      return matchRisk && matchQuery;
    });
  }, [dashboardData?.priorityQueue, riskFilter, search]);

  const activities: DoctorDashboardActivity[] = dashboardData?.activities ?? [];

  const kpis = dashboardData?.kpis ?? {
    totalPatients: 0,
    totalAssessments: 0,
    newAssessments: 0,
    highRiskPatients: 0,
    avgCognitiveTrendDelta: 0,
    avgSessionDurationSeconds: 0,
    limitedSignalSessions: 0,
    unavailableSignalSessions: 0,
  };

  if (!isAuthenticated && !authLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border/70 bg-card/75 p-6 text-sm text-muted-foreground">
          Sign in with an authorized doctor account to access this dashboard.
        </div>
      </div>
    );
  }

  if (isAuthenticated && !authLoading && !isDoctorUser) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border/70 bg-card/75 p-6 text-sm text-muted-foreground">
          Doctor dashboard is available only to users assigned the <span className="font-medium text-foreground">doctor</span> role.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.4 }}
        className="mb-8 rounded-2xl border border-border/70 bg-card/65 p-6"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 font-body text-xs uppercase tracking-[0.2em] text-primary">Doctor Dashboard</p>
            <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              Patient Monitoring Workspace
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review patient trends, prioritize high-risk profiles, and track monitoring signals in one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[560px]">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search patient name or ID"
                className="pl-9"
                aria-label="Search patients"
              />
            </div>

            <Select value={riskFilter} onValueChange={(value: "all" | DoctorRiskLevel) => setRiskFilter(value)}>
              <SelectTrigger aria-label="Filter by risk">
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All risk levels</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Moderate">Moderate</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: SortMode) => setSortBy(value)}>
              <SelectTrigger aria-label="Sort patients">
                <div className="inline-flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="Sort" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="risk">Sort: Risk</SelectItem>
                <SelectItem value="latest">Sort: Last assessment</SelectItem>
                <SelectItem value="recall">Sort: Recall score</SelectItem>
                <SelectItem value="speech">Sort: Speech score</SelectItem>
                <SelectItem value="memory">Sort: Memory score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {(authLoading || dashboardLoading) && (
        <div className="mb-6 space-y-3" aria-live="polite">
          <div className="h-10 animate-pulse rounded-md bg-muted/60" />
          <div className="h-10 animate-pulse rounded-md bg-muted/60" />
          <div className="h-10 animate-pulse rounded-md bg-muted/60" />
        </div>
      )}

      {dashboardError && (
        <p className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {dashboardError}
        </p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Total Patients</CardDescription>
            <CardTitle className="text-2xl">{kpis.totalPatients}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Active monitored profiles
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>New Assessments (7d)</CardDescription>
            <CardTitle className="text-2xl">{kpis.newAssessments}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Updated data in the last 7 days
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Total Assessments</CardDescription>
            <CardTitle className="text-2xl">{kpis.totalAssessments}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All stored sessions in the database
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>High-Risk Patients</CardDescription>
            <CardTitle className="text-2xl text-rose-300">{kpis.highRiskPatients}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Prioritize clinical follow-up
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Avg Cognitive Trend</CardDescription>
            <CardTitle className="text-2xl">{kpis.avgCognitiveTrendDelta}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Delta across recent assessment windows
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Avg Session Duration</CardDescription>
            <CardTitle className="text-2xl">{kpis.avgSessionDurationSeconds}s</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Mean total assessment duration
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Limited Signal Sessions</CardDescription>
            <CardTitle className="text-2xl">{kpis.limitedSignalSessions}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Sessions with constrained camera quality
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Unavailable Signal Sessions</CardDescription>
            <CardTitle className="text-2xl">{kpis.unavailableSignalSessions}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Sessions without usable facial metrics
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="lg:col-span-8"
          aria-label="Patient results table"
        >
          <Card className="border-border/70 bg-card/75">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-xl">Patient Results</CardTitle>
              <CardDescription>
                View all patient assessments, sorted by risk and latest trend scores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!dashboardLoading && filteredPatients.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/35 p-8 text-center text-sm text-muted-foreground">
                  No patient records found for the current filters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Last Assessment</TableHead>
                      <TableHead className="text-right">Recall</TableHead>
                      <TableHead className="text-right">Speech</TableHead>
                      <TableHead className="text-right">Memory</TableHead>
                      <TableHead className="text-right">Sessions</TableHead>
                      <TableHead className="text-right">Session Quality</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">{patient.code}</p>
                          {patient.email ? (
                            <p className="text-[11px] text-muted-foreground/80">{patient.email}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge className={`border ${riskStyle[patient.risk]}`}>{patient.risk}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarDays className="h-4 w-4" />
                            {formatRelativeTime(patient.assessedAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{patient.recallScore}</TableCell>
                        <TableCell className="text-right font-medium">{patient.speechScore}</TableCell>
                        <TableCell className="text-right font-medium">{patient.memoryScore}</TableCell>
                        <TableCell className="text-right font-medium">{patient.assessmentCount}</TableCell>
                        <TableCell className="text-right font-medium capitalize">{patient.sessionQuality}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant={selectedPatientId === patient.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedPatientId(patient.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="lg:col-span-4"
          aria-label="Alert queue"
        >
          <Card className="h-full border-border/70 bg-card/75">
            <CardHeader>
              <CardTitle className="font-display text-xl">Priority Queue</CardTitle>
              <CardDescription>Patients requiring faster clinical review.</CardDescription>
            </CardHeader>
            <CardContent>
              {!priorityQueue.length ? (
                <p className="text-sm text-muted-foreground">No high-priority alerts right now.</p>
              ) : (
                <div className="space-y-3">
                  {priorityQueue.map((item: DoctorDashboardPriorityItem) => (
                    <div
                      key={`${item.patientId}-${item.code}`}
                      className="rounded-xl border border-border/70 bg-background/45 p-3"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.code}</p>
                        </div>
                        <Badge className={`border ${riskStyle[item.risk]}`}>{item.risk}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> Trend alert
                        </span>
                        <span className="font-medium">Cognitive delta: {item.cognitiveDelta}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="lg:col-span-8"
          aria-label="Assessment test suite and latest patient result"
        >
          <DoctorTestCatalog
            patient={selectedPatient}
            deepAnalysis={deepAnalysis}
            onRunDeepAnalysis={runDeepAnalysis}
          />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.45, delay: 0.25 }}
          className="lg:col-span-4"
          aria-label="Recent activity timeline"
        >
          <Card className="h-full border-border/70 bg-card/75">
            <CardHeader>
              <CardTitle className="font-display text-xl">Recent Activity</CardTitle>
              <CardDescription>Latest assessment and follow-up events.</CardDescription>
            </CardHeader>
            <CardContent>
              {!activities.length ? (
                <p className="text-sm text-muted-foreground">No recent activity found.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity: DoctorDashboardActivity) => (
                    <div key={activity.id} className="rounded-xl border border-border/70 bg-background/45 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{activity.patientName}</p>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatRelativeTime(activity.at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{activity.note}</p>
                      <div className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {activity.type === "assessment" && "Assessment"}
                        {activity.type === "follow-up" && "Follow-up"}
                        {activity.type === "flag" && (
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <TrendingDown className="h-3.5 w-3.5" /> Priority Flag
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mt-6 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-xs text-muted-foreground"
      >
        <span className="inline-flex items-center gap-1 text-foreground/85">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          Dashboard live mode
        </span>{" "}
        showing real database-driven doctor analytics with null-safe fallbacks.
      </motion.div>
    </div>
  );
};

export default Dashboard;
