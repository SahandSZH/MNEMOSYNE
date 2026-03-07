import { motion } from "framer-motion";
import { BadgeCheck, Clock3 } from "lucide-react";

const doctors = [
  {
    name: "Dr. Elena Marks",
    specialty: "Neurology",
    availability: "Mon, Wed, Fri",
    initials: "EM",
  },
  {
    name: "Dr. Ali Rafi",
    specialty: "Geriatric Psychiatry",
    availability: "Tue, Thu",
    initials: "AR",
  },
  {
    name: "Dr. Sara Chen",
    specialty: "Cognitive Rehabilitation",
    availability: "Mon to Thu",
    initials: "SC",
  },
];

const Doctors = () => {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
        className="mb-10 max-w-2xl"
      >
        <p className="mb-2 font-body text-xs uppercase tracking-[0.2em] text-primary">Doctors</p>
        <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Specialist team for continuous cognitive monitoring
        </h2>
      </motion.div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {doctors.map((doctor, index) => (
          <motion.article
            key={doctor.name}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: index * 0.1 }}
            className="rounded-2xl border border-border/70 bg-card/70 p-6 shadow-[0_14px_28px_-20px_rgba(8,25,35,0.95)]"
          >
            <div className="mb-4 flex items-center gap-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 font-display font-semibold text-primary">
                {doctor.initials}
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">{doctor.name}</h3>
                <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-foreground/90">
              <p className="inline-flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-primary" />
                Verified specialist
              </p>
              <p className="inline-flex items-center gap-2 text-muted-foreground">
                <Clock3 className="h-4 w-4 text-primary" />
                {doctor.availability}
              </p>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
};

export default Doctors;
