import { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import StatsPanels from "@/components/StatsPanels";

const HeroScene = lazy(() => import("@/components/3d/HeroScene"));

const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* 3D Scene */}
      <Suspense fallback={null}>
        <HeroScene />
      </Suspense>

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-background/90 via-background/50 to-transparent pointer-events-none" />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col justify-center min-h-screen px-6 sm:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-3 py-1 mb-6 text-xs font-display font-semibold uppercase tracking-widest text-primary border border-primary/30 rounded-full glow-border">
              AI-Powered Healthcare
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold leading-tight mb-6"
          >
            <span className="text-foreground">The Future of </span>
            <span className="gradient-text">Patient Monitoring</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg text-muted-foreground font-body leading-relaxed mb-10 max-w-md"
          >
            Real-time neural diagnostics and predictive health analytics
            powered by advanced AI. Monitor, detect, and prevent.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-wrap gap-4 mb-12"
          >
            <button className="px-6 py-3 font-display font-semibold text-sm rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all glow-border">
              Get Started
            </button>
            <button className="px-6 py-3 font-display font-semibold text-sm rounded-lg border border-border text-foreground hover:border-primary/50 transition-all">
              Learn More
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
          >
            <StatsPanels />
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-[2] pointer-events-none" />
    </div>
  );
};

export default Index;
