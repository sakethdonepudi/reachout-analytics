import Navbar from "@/components/site/navbar";
import Hero from "@/components/site/hero";
import HeroFeatures from "@/components/site/hero-features";
import Experience from "@/components/site/experience";
import WorkShowcase from "@/components/site/work-showcase";
import ServicesPreview from "@/components/site/services-preview";
import ContactSection from "@/components/site/contact-section";

export default function Home() {
  return (
    <>
      <Navbar />
      {/* fixed 3D map layer (behind everything) */}
      <Experience />
      <main className="pointer-events-none relative z-[6]">
        <Hero />
        <HeroFeatures />
        {/* scroll length that drives the 3D map tour */}
        <div id="tour" className="pointer-events-none h-[600vh] scroll-mt-24" aria-hidden />
        <WorkShowcase />
        <ServicesPreview />
        <ContactSection />
      </main>
    </>
  );
}
