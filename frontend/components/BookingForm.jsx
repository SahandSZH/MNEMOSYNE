"use client";

import { motion } from "framer-motion";

export default function BookingForm() {
  return (
    <section id="booking" className="py-16 sm:py-20">
      <div className="section-container">
        <div className="medical-card mx-auto max-w-3xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900">Appointment Booking</h2>
          <p className="mt-2 text-slate-600">Book a clinician-led review with a complete patient intake form.</p>

          <motion.form
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mt-6 grid gap-4 sm:grid-cols-2"
          >
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Patient Name</span>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Enter full name"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Doctor</span>
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200">
                <option>Dr. Helen Carter</option>
                <option>Dr. Amir Shah</option>
                <option>Dr. Priya Menon</option>
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Date</span>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Time</span>
              <input
                type="time"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="button"
                className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Confirm Appointment
              </button>
            </div>
          </motion.form>
        </div>
      </div>
    </section>
  );
}