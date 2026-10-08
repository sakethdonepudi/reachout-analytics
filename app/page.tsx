import Navbar from "@/components/site/navbar";
import Hero from "@/components/site/hero";
import IndiaMapFlat from "@/components/site/india-map-flat";
import StateCarousel from "@/components/site/state-carousel";
import ContactSection from "@/components/site/contact-section";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="pointer-events-none relative z-[6]">
        <Hero />

        {/* Flat India map — click Tamil Nadu (or any state with data) to drill in */}
        <section id="tour" className="pointer-events-auto relative bg-background py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-6 text-center sm:px-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Coverage</p>
            <h2 className="mt-3 font-display text-[clamp(28px,3.4vw,44px)] font-semibold tracking-[-0.03em] text-foreground">
              Where we work
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              States with published campaign data are highlighted. Select Tamil Nadu to open its district map.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-[900px] px-4 sm:px-6">
            <IndiaMapFlat />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-2"><span className="size-3 rounded-[3px] border" style={{ background: "var(--map-sel)", borderColor: "var(--map-sel-line)" }} /> With campaign data</span>
            <span className="flex items-center gap-2"><span className="size-3 rounded-[3px] border" style={{ background: "var(--map-fill)", borderColor: "var(--map-line)" }} /> No data</span>
          </div>
        </section>

        <StateCarousel />
        <ContactSection />
      </main>
    </>
  );
}
