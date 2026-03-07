import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface StatItem {
  label: string;
  value: number;
  suffix: string;
  icon: string;
}

const STATS: StatItem[] = [
  { label: "Patients Monitored", value: 12847, suffix: "+", icon: "🫀" },
  { label: "Doctors Connected", value: 3420, suffix: "+", icon: "🩺" },
  { label: "Detection Accuracy", value: 99.7, suffix: "%", icon: "🧠" },
];

const AnimatedNumber = ({ target, suffix }: { target: number; suffix: string }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCurrent(Math.min(step * increment, target));
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  const display = target % 1 === 0 ? Math.floor(current).toLocaleString() : current.toFixed(1);
  return (
    <span>
      {display}
      {suffix}
    </span>
  );
};

const StatsPanels = () => {
  return (
    <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
      {STATS.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 + i * 0.2, duration: 0.6 }}
          className="glass-panel glow-border px-5 py-4 min-w-[180px]"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{stat.icon}</span>
            <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
          <div className="text-2xl font-display font-bold text-primary glow-text">
            <AnimatedNumber target={stat.value} suffix={stat.suffix} />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default StatsPanels;
