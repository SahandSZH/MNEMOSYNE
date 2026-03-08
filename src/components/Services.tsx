import { motion } from "framer-motion";
import { Brain, Mic, PencilRuler } from "lucide-react";

const services = [
  {
    title: "Motor Exercises",
    description: "Visual-motor tasks where users draw target shapes as accurately as possible.",
    Icon: PencilRuler,
  },
  {
    title: "Memory Challenges",
    description: "Short recall tasks using symbols, arithmetic, and color-sequence reproduction.",
    Icon: Brain,
  },
  {
    title: "Speech Analysis",
    description: "Audio prompt and repetition test with transcription capture for later comparison.",
    Icon: Mic,
  },
];

const Services = () => {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
        className="mb-10 max-w-2xl"
      >
        <p className="mb-2 font-body text-xs uppercase tracking-[0.2em] text-primary">Tests</p>
        <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Assessment Metrics
        </h2>
      </motion.div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service, index) => (
          <motion.article
            key={service.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: index * 0.08 }}
            className="rounded-2xl border border-border/70 bg-card/75 p-5 shadow-[0_15px_30px_-22px_rgba(8,25,35,0.95)] backdrop-blur-sm transition-transform hover:-translate-y-1"
          >
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <service.Icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-xl font-medium text-foreground">{service.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
          </motion.article>
        ))}
      </div>
    </div>
  );
};

export default Services;
