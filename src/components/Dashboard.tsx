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
      </motion.div>

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
      </div>
    </div>
  );
};

export default Dashboard;
