import { Suspense, lazy } from "react";

import Navbar from "@/components/Navbar";
import HeroOverlay from "@/components/HeroOverlay";
import Services from "@/components/Services";
import Dashboard from "@/components/Dashboard";
import Doctors from "@/components/Doctors";
import BookingForm from "@/components/BookingForm";
import Testimonials from "@/components/Testimonials";

const HeroScene = lazy(() => import("@/components/3d/HeroScene"));

const Index = () => {
  return (
    <div className="relative bg-background text-foreground">
      <Navbar />

      <section id="home" className="relative min-h-screen overflow-hidden">
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_78%_40%,rgba(64,196,214,0.18)_0%,transparent_40%),linear-gradient(to_right,rgba(7,20,30,0.94),rgba(7,20,30,0.56),rgba(7,20,30,0.3))]" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] h-28 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <HeroOverlay />
      </section>

      <main className="relative z-10">
        <section id="services" className="scroll-mt-24 py-16 sm:py-20">
          <Services />
        </section>

        <section
          id="dashboard"
          className="scroll-mt-24 bg-[linear-gradient(180deg,rgba(6,20,30,0.1),rgba(6,20,30,0.34),rgba(6,20,30,0.1))] py-16 sm:py-20"
        >
          <Dashboard />
        </section>

        <section id="doctors" className="scroll-mt-24 py-16 sm:py-20">
          <Doctors />
        </section>

        <section
          id="book-appointment"
          className="scroll-mt-24 bg-[linear-gradient(120deg,rgba(65,200,220,0.08),rgba(7,22,32,0.42),rgba(65,200,220,0.08))] py-16 sm:py-20"
        >
          <BookingForm />
        </section>

        <section id="testimonials" className="scroll-mt-24 py-16 sm:py-20">
          <Testimonials />
        </section>
      </main>
    </div>
  );
};

export default Index;
