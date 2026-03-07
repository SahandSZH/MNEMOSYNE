import Navbar from "@/components/Navbar";
import HeroOverlay from "@/components/HeroOverlay";
import Services from "@/components/Services";
import Dashboard from "@/components/Dashboard";
import Doctors from "@/components/Doctors";
import BookingForm from "@/components/BookingForm";
import Testimonials from "@/components/Testimonials";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroOverlay />
      <Services />
      <Dashboard />
      <Doctors />
      <BookingForm />
      <Testimonials />
    </main>
  );
}