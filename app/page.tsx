import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeHeader from "@/components/home/home-header";
import PrecisionHero from "@/components/home/precision-hero";
import Experience from "@/components/site/experience";
import WorkShowcase from "@/components/site/work-showcase";
import CompanyExperience from "@/components/site/company-marquee";
import SiteFooter from "@/components/site/site-footer";
import { COOKIE, LEGACY_COOKIE, getSessionByToken } from "@/lib/auth";
import { isLiveCase, orderedCases } from "@/lib/cases";

export const dynamic = "force-dynamic";

export default async function Home() {
  const jar = await cookies();
  const session = await getSessionByToken(jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value);
  if (session?.role === "owner") redirect("/dashboard");

  const cases = orderedCases().map((item) => ({ slug: item.slug, party: item.party, projectedLead: item.projectedLead, stateName: item.stateName, year: item.year, comingSoon: !isLiveCase(item.slug) }));

  return (
    <>
      <HomeHeader role={session?.role === "client" ? "client" : "anon"} displayName={session?.displayName} cases={cases} />
      <main className="pointer-events-none relative z-10 bg-white">
        <PrecisionHero cases={cases} />
        <Experience />
        <WorkShowcase />
        <CompanyExperience />
        <SiteFooter />
      </main>
    </>
  );
}
