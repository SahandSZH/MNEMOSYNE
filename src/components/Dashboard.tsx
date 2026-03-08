import { useEffect, useMemo, useState } from "react";
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

import type { ContributingSignal } from "@/types/presage";

type RiskLevel = "Low" | "Moderate" | "High";
type SortMode = "risk" | "latest" | "recall" | "speech" | "engagement";
type TrendPoint = {
  label: string;
  cognitive: number;
  speech: number;
  engagement: number;
};

type PatientActivity = {
  id: string;
  at: string;
  note: string;
  type: "assessment" | "follow-up" | "flag";
};

type PatientRow = {
  id: string;
  name: string;
  code: string;
  risk: RiskLevel;
  assessedAt: string;
  recallScore: number;
  speechScore: number;
  engagementScore: number;
  summary: string;
  contributingSignals: ContributingSignal[];
  trends: TrendPoint[];
  activities: PatientActivity[];
};

const mockPatients: PatientRow[] = [
  {
    id: "pt-1001",
    name: "Eleanor Hayes",
    code: "PT-1001",
    risk: "Low",
    assessedAt: "2026-03-06T10:15:00.000Z",
    recallScore: 84,
    speechScore: 81,
    engagementScore: 78,
    summary:
      "Monitoring-only view: cognitive and speech scores remain stable across recent assessments.",
    contributingSignals: [
      {
        signal: "engagement",
        direction: "stable",
        delta: -0.01,
        confidence: 0.76,
        note: "Engagement is near baseline over the last three sessions.",
      },
      {
        signal: "speech fluency",
        direction: "up",
        delta: 0.05,
        confidence: 0.72,
        note: "Speech fluency improved during guided prompts.",
      },
    ],
    trends: [
      { label: "Jan", cognitive: 82, speech: 79, engagement: 74 },
      { label: "Feb", cognitive: 84, speech: 80, engagement: 76 },
      { label: "Mar", cognitive: 84, speech: 81, engagement: 78 },
    ],
    activities: [
      {
        id: "a-1",
        at: "2026-03-06T10:15:00.000Z",
        note: "Completed full remote assessment session.",
        type: "assessment",
      },
      {
        id: "a-2",
        at: "2026-03-05T15:40:00.000Z",
        note: "Care plan follow-up note added by clinician.",
        type: "follow-up",
      },
    ],
  },
  {
    id: "pt-1002",
    name: "Miguel Vance",
    code: "PT-1002",
    risk: "Moderate",
    assessedAt: "2026-03-04T14:05:00.000Z",
    recallScore: 68,
    speechScore: 66,
    engagementScore: 63,
    summary:
      "Monitoring-only view: mild decline in verbal fluency with moderate variance in attention.",
    contributingSignals: [
      {
        signal: "speech fluency",
        direction: "down",
        delta: -0.12,
        confidence: 0.84,
        note: "Speech pacing slowed versus prior month baseline.",
      },
      {
        signal: "blink rate",
        direction: "up",
        delta: 0.09,
        confidence: 0.69,
        note: "Increased blink rate during recall segment.",
      },
    ],
    trends: [
      { label: "Jan", cognitive: 73, speech: 72, engagement: 67 },
      { label: "Feb", cognitive: 70, speech: 69, engagement: 64 },
      { label: "Mar", cognitive: 68, speech: 66, engagement: 63 },
    ],
    activities: [
      {
        id: "a-3",
        at: "2026-03-04T14:05:00.000Z",
        note: "Assessment submitted with limited camera quality flag.",
        type: "flag",
      },
      {
        id: "a-4",
        at: "2026-03-03T09:10:00.000Z",
        note: "Doctor requested a repeat speech task next week.",
        type: "follow-up",
      },
    ],
  },
  {
    id: "pt-1003",
    name: "Linda Fox",
    code: "PT-1003",
    risk: "High",
    assessedAt: "2026-03-08T08:45:00.000Z",
    recallScore: 49,
    speechScore: 53,
    engagementScore: 51,
    summary:
      "Monitoring-only view: notable change across memory and engagement trends. Clinical review recommended.",
    contributingSignals: [
      {
        signal: "memory recall",
        direction: "down",
        delta: -0.21,
        confidence: 0.9,
        note: "Recall performance declined across three consecutive assessments.",
      },
      {
        signal: "engagement",
        direction: "down",
        delta: -0.16,
        confidence: 0.86,
        note: "Sustained lower engagement in final two sessions.",
      },
    ],
    trends: [
      { label: "Jan", cognitive: 66, speech: 61, engagement: 59 },
      { label: "Feb", cognitive: 58, speech: 57, engagement: 55 },
      { label: "Mar", cognitive: 49, speech: 53, engagement: 51 },
    ],
    activities: [
      {
        id: "a-5",
        at: "2026-03-08T08:45:00.000Z",
        note: "High-priority trend alert generated for clinician review.",
        type: "flag",
      },
      {
        id: "a-6",
        at: "2026-03-07T17:20:00.000Z",
        note: "Latest assessment uploaded from patient device.",
        type: "assessment",
      },
    ],
  },
  {
    id: "pt-1004",
    name: "Harold Quinn",
    code: "PT-1004",
    risk: "Low",
    assessedAt: "2026-03-07T12:12:00.000Z",
    recallScore: 79,
    speechScore: 76,
    engagementScore: 81,
    summary:
      "Monitoring-only view: stable metrics and improved session consistency.",
    contributingSignals: [
      {
        signal: "engagement",
        direction: "up",
        delta: 0.11,
        confidence: 0.78,
        note: "Engagement improved in both prompted and free-speech segments.",
      },
    ],
    trends: [
      { label: "Jan", cognitive: 74, speech: 72, engagement: 73 },
      { label: "Feb", cognitive: 77, speech: 74, engagement: 78 },
      { label: "Mar", cognitive: 79, speech: 76, engagement: 81 },
    ],
    activities: [
      {
        id: "a-7",
        at: "2026-03-07T12:12:00.000Z",
        note: "Assessment quality marked good.",
        type: "assessment",
      },
    ],
  },
  {
    id: "pt-1005",
    name: "Nadia Romero",
    code: "PT-1005",
    risk: "Moderate",
    assessedAt: "2026-03-02T16:33:00.000Z",
    recallScore: 64,
    speechScore: 70,
    engagementScore: 61,
    summary:
      "Monitoring-only view: mixed profile with lower engagement but consistent speech output.",
    contributingSignals: [
      {
        signal: "session consistency",
        direction: "down",
        delta: -0.08,
        confidence: 0.7,
        note: "Inconsistent completion pattern may have reduced signal quality.",
      },
      {
        signal: "speech fluency",
        direction: "stable",
        delta: 0.01,
        confidence: 0.73,
        note: "Speech fluency remained near baseline.",
      },
    ],
    trends: [
      { label: "Jan", cognitive: 67, speech: 69, engagement: 65 },
      { label: "Feb", cognitive: 65, speech: 70, engagement: 63 },
      { label: "Mar", cognitive: 64, speech: 70, engagement: 61 },
    ],
    activities: [
      {
        id: "a-8",
        at: "2026-03-02T16:33:00.000Z",
        note: "Session completed with limited camera signal warning.",
        type: "flag",
      },
    ],
  },
];

const riskWeight: Record<RiskLevel, number> = {
  Low: 1,
  Moderate: 2,
  High: 3,
};

const riskStyle: Record<RiskLevel, string> = {
  Low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  Moderate: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  High: "border-rose-500/35 bg-rose-500/15 text-rose-200",
};

const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatRelativeTime = (value: string) => {
  const now = Date.now();
  const timestamp = new Date(value).getTime();
  const diffHours = Math.max(1, Math.floor((now - timestamp) / (1000 * 60 * 60)));

  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatShortDate(value);
};

const calculateTrendDelta = (points: TrendPoint[], key: keyof TrendPoint) => {
  if (points.length < 2) return 0;
  const first = Number(points[0][key]);
  const last = Number(points[points.length - 1][key]);
  return Number((last - first).toFixed(1));
};

const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");
  const [sortBy, setSortBy] = useState<SortMode>("risk");
  const [selectedPatientId, setSelectedPatientId] = useState(mockPatients[0]?.id ?? "");

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 300);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = mockPatients.filter((patient) => {
      const matchRisk = riskFilter === "all" || patient.risk === riskFilter;
      const matchQuery =
        !query ||
        patient.name.toLowerCase().includes(query) ||
        patient.code.toLowerCase().includes(query);
      return matchRisk && matchQuery;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "latest":
          return new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime();
        case "recall":
          return b.recallScore - a.recallScore;
        case "speech":
          return b.speechScore - a.speechScore;
        case "engagement":
          return b.engagementScore - a.engagementScore;
        case "risk":
        default:
          return riskWeight[b.risk] - riskWeight[a.risk];
      }
    });

    return sorted;
  }, [riskFilter, search, sortBy]);

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

  const selectedPatient =
    filteredPatients.find((patient) => patient.id === selectedPatientId) ?? null;

  const allActivities = useMemo(
    () =>
      mockPatients
        .flatMap((patient) =>
          patient.activities.map((activity) => ({
            ...activity,
            patientName: patient.name,
          })),
        )
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 8),
    [],
  );

  const alertQueue = useMemo(
    () =>
      mockPatients
        .map((patient) => ({
          patient,
          delta: calculateTrendDelta(patient.trends, "cognitive"),
        }))
        .filter(({ patient, delta }) => patient.risk === "High" || delta <= -8)
        .sort((a, b) => riskWeight[b.patient.risk] - riskWeight[a.patient.risk]),
    [],
  );

  const kpis = useMemo(() => {
    const totalPatients = mockPatients.length;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newAssessments = mockPatients.filter(
      (patient) => new Date(patient.assessedAt).getTime() >= weekAgo,
    ).length;
    const highRisk = mockPatients.filter((patient) => patient.risk === "High").length;
    const avgCognitiveDelta =
      mockPatients.reduce((sum, patient) => sum + calculateTrendDelta(patient.trends, "cognitive"), 0) /
      totalPatients;

    return {
      totalPatients,
      newAssessments,
      highRisk,
      avgCognitiveDelta: Number(avgCognitiveDelta.toFixed(1)),
    };
  }, []);

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

            <Select value={riskFilter} onValueChange={(value: "all" | RiskLevel) => setRiskFilter(value)}>
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
                <SelectItem value="engagement">Sort: Engagement score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

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
            <CardDescription>High-Risk Patients</CardDescription>
            <CardTitle className="text-2xl text-rose-300">{kpis.highRisk}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Prioritize clinical follow-up
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Avg Cognitive Trend</CardDescription>
            <CardTitle className="text-2xl">{kpis.avgCognitiveDelta}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Delta across recent assessment windows
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
              {isLoading ? (
                <div className="space-y-3" aria-live="polite">
                  <div className="h-10 animate-pulse rounded-md bg-muted/60" />
                  <div className="h-10 animate-pulse rounded-md bg-muted/60" />
                  <div className="h-10 animate-pulse rounded-md bg-muted/60" />
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/35 p-8 text-center text-sm text-muted-foreground">
                  No patients match your current filters. Try a different search or risk selection.
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
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">{patient.code}</p>
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
                        <TableCell className="text-right font-medium">{patient.engagementScore}</TableCell>
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
              {!alertQueue.length ? (
                <p className="text-sm text-muted-foreground">No high-priority alerts right now.</p>
              ) : (
                <div className="space-y-3">
                  {alertQueue.map(({ patient, delta }) => (
                    <div
                      key={patient.id}
                      className="rounded-xl border border-border/70 bg-background/45 p-3"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">{patient.code}</p>
                        </div>
                        <Badge className={`border ${riskStyle[patient.risk]}`}>{patient.risk}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> Trend alert
                        </span>
                        <span className="font-medium">Cognitive delta: {delta}</span>
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
          <DoctorTestCatalog patient={selectedPatient} />
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
              <div className="space-y-3">
                {allActivities.map((activity) => (
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
          Dashboard preview mode
        </span>{" "}
        with mock patient data for UI/UX iteration.
      </motion.div>
    </div>
  );
};

export default Dashboard;
