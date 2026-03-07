"use client";

import { motion } from "framer-motion";

const testimonials = [
  {
    quote: "The dashboard made it easy to follow my father’s progress and share updates with his specialist.",
    person: "Family Caregiver",
  },
  {
    quote: "The speech and cognition trends are clear and clinically useful for follow-up visits.",
    person: "Neurology Clinic",
  },
  {
    quote: "Simple to use, calm design, and easy for older adults during check-in sessions.",
    person: "Care Coordinator",
  },
];

export default function Testimonials() {
  return (
    <section className="pb-20 pt-16 sm:pb-24 sm:pt-20">
      <div className="section-container">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Patient Testimonials</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {testimonials.map((item, i) => (
            <motion.blockquote
              key={item.person}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="medical-card p-6 transition-shadow hover:shadow-md"
            >
              <p className="text-sm leading-6 text-slate-700">"{item.quote}"</p>
              <footer className="mt-4 text-sm font-semibold text-slate-900">{item.person}</footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}