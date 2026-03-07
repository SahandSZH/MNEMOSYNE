"use client";

import { motion } from "framer-motion";

function LineTrend({ data, color, ariaLabel }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const width = 320;
  const height = 120;

  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / Math.max(1, max - min)) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" role="img" aria-label={ariaLabel}>
      <polyline fill="none" stroke={color} strokeWidth="3" points={points} strokeLinecap="round" />
    </svg>
  );
}

function ScoreBars({ scores }) {
  const max = 100;
  return (
    <div className="grid grid-cols-6 gap-2" role="img" aria-label="Functional health score trend chart">
      {scores.map((score, idx) => (
        <div key={idx} className="flex flex-col items-center gap-2">
          <div className="h-28 w-7 rounded bg-slate-100">
            <motion.div
              initial={{ height: 0 }}
              whileInView={{ height: `${(score / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.07 }}
              className="w-full rounded bg-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-500">W{idx + 1}</span>
        </div>
      ))}
    </div>
  );
}

const patients = [
  { name: "A. Reynolds", age: 74, status: "Stable" },
  { name: "M. Turner", age: 69, status: "Review" },
  { name: "S. Patel", age: 77, status: "Stable" },
  { name: "J. Kim", age: 71, status: "Attention" },
];

export default function Dashboard() {
  return (
    <section id="dashboard" className="py-16 sm:py-20">
      <div className="section-container">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Doctor Dashboard</h2>
            <p className="mt-2 text-slate-600">Patient overview and cognitive trend monitoring.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <article className="medical-card p-5 lg:col-span-1">
            <h3 className="text-base font-semibold text-slate-900">Patient List</h3>
            <ul className="mt-4 space-y-3">
              {patients.map((patient) => (
                <li key={patient.name} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{patient.name}</p>
                    <p className="text-xs text-slate-500">Age {patient.age}</p>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      patient.status === "Stable"
                        ? "bg-emerald-100 text-emerald-700"
                        : patient.status === "Review"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {patient.status}
                  </span>
                </li>
              ))}
            </ul>
          </article>

          <article className="medical-card p-5 lg:col-span-2">
            <h3 className="text-base font-semibold text-slate-900">Patient Cognitive Score Trend</h3>
            <LineTrend data={[81, 80, 79, 77, 78, 76, 74]} color="#0284c7" ariaLabel="Cognitive score trend" />
          </article>

          <article className="medical-card p-5 lg:col-span-2">
            <h3 className="text-base font-semibold text-slate-900">Speech Fluency Trend</h3>
            <LineTrend data={[88, 86, 84, 82, 81, 80, 77]} color="#0ea5e9" ariaLabel="Speech fluency trend" />
          </article>

          <article className="medical-card p-5 lg:col-span-1">
            <h3 className="text-base font-semibold text-slate-900">Functional Health Score</h3>
            <div className="mt-4">
              <ScoreBars scores={[84, 82, 83, 80, 78, 76]} />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}