import Navbar from "@/components/site/navbar";
import Hero from "@/components/site/hero";
import StateCarousel from "@/components/site/state-carousel";
import Experience from "@/components/site/experience";
import ContactSection from "@/components/site/contact-section";

export default function Home() {
  return (
    <>
      <Navbar />
      {/* fixed 3D map layer (behind everything) */}
      <Experience />
      <main className="pointer-events-none relative z-[6]">
        <Hero />
        {/* scroll length that drives the 3D map tour */}
        <div id="tour" className="pointer-events-none h-[600vh]" aria-hidden />
        <StateCarousel />
        <ContactSection />
      </main>
    </>
  );
}
