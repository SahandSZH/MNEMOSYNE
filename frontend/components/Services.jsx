"use client";

import { motion } from "framer-motion";

const services = [
  {
    icon: "??",
    title: "Cognitive Testing",
    description: "Standardized memory and attention checks to identify meaningful changes over time.",
  },
  {
    icon: "???",
    title: "Speech Analysis",
    description: "Track fluency and linguistic markers linked to early cognitive decline.",
  },
  {
    icon: "??",
    title: "Doctor Monitoring",
    description: "Clinical dashboard with patient trends, risk flags, and actionable summaries.",
  },
  {
    icon: "??",
    title: "AI Health Insights",
    description: "Simple, interpretable insights to support clinician review and planning.",
  },
];

export default function Services() {
  return (
    <section id="services" className="py-16 sm:py-20">
      <div className="section-container">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Services</h2>
        <p className="mt-3 max-w-2xl text-slate-600">Purpose-built modules for patient assessment and physician monitoring.</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service, index) => (
            <motion.article
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.08 }}
              className="medical-card p-6"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-2xl">
                {service.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{service.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}