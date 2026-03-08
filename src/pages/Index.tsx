import { Suspense, lazy } from "react";

import Navbar from "@/components/Navbar";
import HeroOverlay from "@/components/HeroOverlay";
import Services from "@/components/Services";
// import AuthApiTester from "@/components/AuthApiTester";
// import Doctors from "@/components/Doctors";
// import Testimonials from "@/components/Testimonials";

const HeroScene = lazy(() => import("@/components/3d/HeroScene"));

const Index = () => {
  return (
    <div className="relative bg-background text-foreground">
      <Navbar />

      <section id="home" className="relative min-h-screen overflow-hidden">
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
        <div className="pointer-events-none absolute inset-0 z-[1] bg-black/12" />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_78%_40%,rgba(64,196,214,0.08)_0%,transparent_60%),linear-gradient(to_right,rgba(7,20,30,0.36),rgba(7,20,30,0.2),rgba(7,20,30,0.1))]" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] h-28 bg-gradient-to-t from-background via-background/42 to-transparent" />
        <HeroOverlay />
      </section>

      <main className="relative z-10">
        <section id="services" className="scroll-mt-24 py-16 sm:py-20">
          <Services />
        </section>

        {/*
        <section
          id="auth-api-test"
          className="scroll-mt-24 bg-[linear-gradient(180deg,rgba(6,20,30,0.1),rgba(6,20,30,0.34),rgba(6,20,30,0.1))] py-16 sm:py-20"
        >
          <AuthApiTester />
        </section>
        */}

        {/*
        <section
          id="dashboard"
          className="scroll-mt-24 bg-[linear-gradient(180deg,rgba(6,20,30,0.1),rgba(6,20,30,0.34),rgba(6,20,30,0.1))] py-16 sm:py-20"
        >
          <Dashboard />
        </section>
        */}

        {/*
        <section id="doctors" className="scroll-mt-24 py-16 sm:py-20">
          <Doctors />
        </section>
        */}

        {/*
          <section
            id="book-appointment"
            className="scroll-mt-24 bg-[linear-gradient(120deg,rgba(65,200,220,0.08),rgba(7,22,32,0.42),rgba(65,200,220,0.08))] py-16 sm:py-20"
          >
            <BookingForm />
          </section>
        */}

        {/*
        <section id="testimonials" className="scroll-mt-24 py-16 sm:py-20">
          <Testimonials />
        </section>
        */}
      </main>
    </div>
  );
};

export default Index;
