import { motion } from "framer-motion";
import { ArrowRight, Activity } from "lucide-react";

const HeroOverlay = () => {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 pb-16 pt-28 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/35 bg-background/45 px-4 py-1.5 text-xs font-body font-medium uppercase tracking-[0.22em] text-primary backdrop-blur"
        >
          <Activity className="h-3.5 w-3.5" />
          Dementia Monitoring Platform
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-balance font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl"
        >
          Mnemosyne Intelligence
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground"
        >
          Modern Care for Cognitive Health
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-9 flex flex-wrap gap-3"
        >
          <a
            href="#book-appointment"
            className="inline-flex min-w-48 items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Start Checkup
            <ArrowRight className="h-4 w-4" />
          </a>
          {/*
          <a
            href="#dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            View Doctor Dashboard
          </a>
          */}
        </motion.div>
      </div>
    </div>
  );
};

export default HeroOverlay;
