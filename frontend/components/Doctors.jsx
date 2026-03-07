"use client";

import { motion } from "framer-motion";

const doctors = [
  { name: "Dr. Helen Carter", specialty: "Neurology" },
  { name: "Dr. Amir Shah", specialty: "Geriatric Psychiatry" },
  { name: "Dr. Priya Menon", specialty: "Cognitive Care" },
];

export default function Doctors() {
  return (
    <section id="doctors" className="py-16 sm:py-20">
      <div className="section-container">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Doctors</h2>
        <p className="mt-2 text-slate-600">Care team visibility for continuous monitoring.</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor, i) => (
            <motion.article
              key={doctor.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="medical-card p-6"
            >
              <div className="mb-4 h-12 w-12 rounded-full bg-sky-100" />
              <h3 className="text-lg font-semibold text-slate-900">{doctor.name}</h3>
              <p className="text-sm text-slate-600">{doctor.specialty}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}