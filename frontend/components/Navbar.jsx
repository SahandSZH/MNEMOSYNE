"use client";

import { motion } from "framer-motion";

const navItems = [
  { label: "Dashboard", href: "#dashboard" },
  { label: "Services", href: "#services" },
  { label: "Doctors", href: "#doctors" },
  { label: "Book Appointment", href: "#booking" },
];

export default function Navbar() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45 }}
      className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur"
    >
      <nav className="section-container flex h-16 items-center justify-between">
        <a href="#" className="flex items-center gap-2 text-lg font-semibold text-sky-800">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-100 text-sky-700">+</span>
          NeuroCare
        </a>

        <ul className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                className="text-sm font-medium text-slate-600 transition hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#booking"
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          Appointment
        </a>
      </nav>
    </motion.header>
  );
}