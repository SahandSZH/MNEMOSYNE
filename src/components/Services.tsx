import { motion } from "framer-motion";
import { BrainCircuit, Mic, Stethoscope, Sparkles } from "lucide-react";

const services = [
  {
    title: "Cognitive Testing",
    description: "Structured memory and attention checks with clinician-friendly summaries.",
    Icon: BrainCircuit,
  },
  {
    title: "Speech Analysis",
    description: "Track fluency, pauses, and verbal clarity over time using guided speech tasks.",
    Icon: Mic,
  },
  {
    title: "Doctor Monitoring",
    description: "Live monitoring panel for trends, patient progress flags, and intervention timing.",
    Icon: Stethoscope,
  },
  {
    title: "AI Health Insights",
    description: "Clinical AI support for risk patterns and treatment plan prioritization.",
    Icon: Sparkles,
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
        <p className="mb-2 font-body text-xs uppercase tracking-[0.2em] text-primary">Services</p>
        <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Clinical workflows designed for dementia care
        </h2>
      </motion.div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
