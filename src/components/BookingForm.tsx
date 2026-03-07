import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { CalendarIcon, Clock3 } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const BookingForm = () => {
  const [appointmentDate, setAppointmentDate] = useState<Date>();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
        className="mb-10 max-w-2xl"
      >
        <p className="mb-2 font-body text-xs uppercase tracking-[0.2em] text-primary">Appointment Booking</p>
        <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Schedule a clinical assessment
        </h2>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border/70 bg-card/75 p-6 shadow-[0_16px_32px_-20px_rgba(8,25,35,0.95)] sm:p-8"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="patient-name">Patient Name</Label>
            <Input id="patient-name" name="patientName" placeholder="Enter full name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doctor">Doctor Selection</Label>
            <Select name="doctor" required>
              <SelectTrigger id="doctor">
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="elena-marks">Dr. Elena Marks</SelectItem>
                <SelectItem value="ali-rafi">Dr. Ali Rafi</SelectItem>
                <SelectItem value="sara-chen">Dr. Sara Chen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Calendar Picker</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !appointmentDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {appointmentDate ? format(appointmentDate, "PPP") : "Pick an appointment date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={appointmentDate} onSelect={setAppointmentDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time Selection</Label>
            <Select name="time" required>
              <SelectTrigger id="time" className="w-full">
                <Clock3 className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Choose time slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="09:00">09:00 AM</SelectItem>
                <SelectItem value="10:30">10:30 AM</SelectItem>
                <SelectItem value="13:00">01:00 PM</SelectItem>
                <SelectItem value="15:30">03:30 PM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <Label htmlFor="notes">Notes for Care Team</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Optional symptom notes, concerns, or language preference."
            className="min-h-[92px]"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="submit" className="min-w-40">
            Confirm Appointment
          </Button>
          {submitted && (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              Booking form captured locally. Frontend-only flow is active.
            </p>
          )}
        </div>
      </motion.form>
    </div>
  );
};

export default BookingForm;
