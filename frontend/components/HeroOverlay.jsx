"use client";

import { motion } from "framer-motion";

export default function HeroOverlay() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_#dbeafe_0%,_transparent_50%),radial-gradient(circle_at_bottom_left,_#bfdbfe_0%,_transparent_45%)]" />
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="medical-card max-w-3xl p-8 sm:p-12"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Dementia Monitoring Platform</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-5xl">
            Modern Care for Cognitive Health
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
            Track cognitive changes early, support clinical decisions, and improve patient outcomes with a calm,
            clinician-friendly interface.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#booking"
              className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Start Checkup
            </a>
            <a
              href="#dashboard"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              View Doctor Dashboard
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}