import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeHeader from "@/components/home/home-header";
import PrecisionHero from "@/components/home/precision-hero";
import HeroFeatures from "@/components/site/hero-features";
import Experience from "@/components/site/experience";
import WorkShowcase from "@/components/site/work-showcase";
import ServicesPreview from "@/components/site/services-preview";
import ContactSection from "@/components/site/contact-section";
import { COOKIE, LEGACY_COOKIE, getSessionByToken } from "@/lib/auth";
import { CASES } from "@/lib/cases";

export const dynamic = "force-dynamic";

export default async function Home() {
  const jar = await cookies();
  const session = await getSessionByToken(jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value);
  if (session?.role === "owner") redirect("/dashboard");

  const cases = CASES.map((item) => ({ slug: item.slug, party: item.party, stateName: item.stateName }));

  return (
    <>
      <HomeHeader role={session?.role === "client" ? "client" : "anon"} displayName={session?.displayName} cases={cases} />
      {/* Fixed 3D map layer. The opaque white hero sits above it; the tour starts below. */}
      <Experience />
      <main className="pointer-events-none relative z-[6]">
        <PrecisionHero cases={cases} />
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
