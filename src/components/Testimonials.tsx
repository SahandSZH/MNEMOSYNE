import { motion } from "framer-motion";

const testimonials = [
  {
    quote:
      "The monitoring dashboard helped us catch small cognitive shifts early and discuss treatment faster.",
    name: "Sophie T.",
    role: "Family Caregiver",
  },
  {
    quote:
      "Speech trend graphs make progress visible. I can adjust follow-ups with clearer confidence.",
    name: "Dr. Elena Marks",
    role: "Neurology Specialist",
  },
  {
    quote:
      "The interface is calm and easy for my family to use. Booking and checkups finally feel coordinated.",
    name: "Marcus H.",
    role: "Patient Advocate",
  },
];

const Testimonials = () => {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
        className="mb-10 max-w-2xl"
      >
        <p className="mb-2 font-body text-xs uppercase tracking-[0.2em] text-primary">Patient Testimonials</p>
        <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Trusted by families and clinicians
        </h2>
      </motion.div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((testimonial, index) => (
          <motion.article
            key={testimonial.name}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: index * 0.08 }}
            className="rounded-2xl border border-border/70 bg-card/75 p-6 shadow-[0_18px_32px_-24px_rgba(8,25,35,0.95)]"
          >
            <p className="text-sm leading-relaxed text-foreground/95">"{testimonial.quote}"</p>
            <div className="mt-5">
              <p className="font-display text-base font-semibold text-foreground">{testimonial.name}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{testimonial.role}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
};

export default Testimonials;
