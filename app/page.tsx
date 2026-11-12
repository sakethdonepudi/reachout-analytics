import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PublicNavbar from "@/components/site/public-navbar-static";
import ContactSection from "@/components/site/contact-section";
import { Logo } from "@/components/site/brand";
import HomeIndiaMap from "@/components/site/home-india-map";
import { CASES, UPCOMING } from "@/lib/cases";
import { POLITICAL_SERVICES, DATA_SERVICES } from "@/lib/services";
import { TN_OPINION_POLL } from "@/lib/tamil-nadu/comparison";
import { TVK_ACTUAL_SEATS, TVK_FORECASTERS } from "@/lib/tamil-nadu/forecasters";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "ReachOut Analytics - Election research and reporting",
  description:
    "India's political analytics and campaign strategy experts. Voter insights, election predictions and digital boosting across India.",
};

function yearFor(slug: string): number {
  const match = slug.match(/(20\d{2})/);
  if (match) return Number(match[1]);
  if (slug === "telangana") return 2028;
  if (slug === "tamil-nadu") return 2026;
  return 2026;
}

function statusFor(slug: string): "Validated" | "Live" | "Upcoming" {
  if (slug.includes("2029") || slug.includes("up-maharashtra")) return "Upcoming";
  if (["tamil-nadu", "telangana", "andhra-pradesh-2024", "karnataka-2023"].includes(slug)) return "Validated";
  return "Live";
}

const statesCovered = new Set(CASES.map((item) => item.stateName)).size;
const electionsTracked = CASES.length;
const surveyResponses = TN_OPINION_POLL.denominator;
const reachOutTn = TVK_FORECASTERS.find((item) => item.forecaster.startsWith("ReachOut"));
const tnGap = reachOutTn && reachOutTn.projectedSeats != null ? Math.abs(reachOutTn.projectedSeats - TVK_ACTUAL_SEATS) : null;

const scoreboard = [
  { label: "States covered", value: String(statesCovered), note: "Case registry, unique state names" },
  { label: "Survey responses", value: surveyResponses.toLocaleString("en-IN"), note: "Tamil Nadu opinion poll, 31,672 valid responses" },
  { label: "Elections tracked", value: String(electionsTracked), note: "Case registry, current case studies" },
  { label: "Tamil Nadu 2026", value: tnGap == null ? "-" : `${tnGap} seats`, note: reachOutTn ? `${reachOutTn.projectedSeats ?? "-"} projected, ${TVK_ACTUAL_SEATS} actual` : "Forecast comparison" },
];

const selected = ["tamil-nadu", "telangana", "andhra-pradesh-2024", "karnataka-2023"]
  .map((slug) => CASES.find((item) => item.slug === slug))
  .filter((item): item is (typeof CASES)[number] => Boolean(item));

const services = [...POLITICAL_SERVICES.slice(0, 4), ...DATA_SERVICES.slice(0, 2)];

const covered = [
  ...CASES.map((item) => ({ slug: item.slug, title: item.title, state: item.stateName, code: item.state, year: yearFor(item.slug), status: statusFor(item.slug) })),
  ...UPCOMING.map((item) => ({ slug: item.slug, title: item.title, state: "India", code: null, year: yearFor(item.slug), status: "Upcoming" as const })),
];

export default function Home() {
  return (
    <>
      <PublicNavbar />
      <main className="report-shell pt-14">
        <header className="report-band">
          <div className="report-wrap">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">ReachOut Analytics</p>
                <h1 className="mt-3">Election research, explained clearly.</h1>
                <p>
                  ReachOut Analytics turns surveys, election results and campaign data into practical reports for political teams.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/case-studies" className="report-btn">View case studies <ArrowRight className="size-4" /></Link>
                  <a href="#contact" className="report-btn-secondary">Contact</a>
                </div>
              </div>
              <div className="shrink-0 pt-1"><Logo variant="dark" /></div>
            </div>
          </div>
        </header>

        <section className="border-b border-[var(--r-line)] bg-white py-6" aria-label="Scoreboard">
          <div className="report-wrap grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {scoreboard.map((item) => (
              <div key={item.label} className="report-stat">
                <p className="report-stat-label">{item.label}</p>
                <p className="report-stat-value">{item.value}</p>
                <p className="report-stat-note good">{item.note}</p>
              </div>
            ))}
          </div>
          <div className="report-wrap mt-4">
            <p className="report-note">
              Sources: case registry for states and elections, the Tamil Nadu opinion poll denominator for survey responses (31,672), and the Tamil Nadu forecaster table for the 106 projected and 108 actual seats.
            </p>
          </div>
        </section>

        <section className="report-section" aria-labelledby="elections-covered">
          <div className="report-wrap">
            <h2 id="elections-covered" className="report-heading">Elections covered</h2>
            <p className="report-sub">States and election cycles available in the case registry.</p>
            <div className="overflow-x-auto rounded-[10px] border border-[var(--r-line)] bg-white">
              <table className="w-full min-w-[520px] text-left text-[13.5px]">
                <caption className="sr-only">Elections covered by ReachOut Analytics</caption>
                <thead><tr><th className="px-3 py-2.5">State</th><th className="px-3 py-2.5">Case study</th><th className="px-3 py-2.5 text-right">Year</th><th className="px-3 py-2.5">Status</th></tr></thead>
                <tbody>
                  {covered.map((item) => (
                    <tr key={`${item.slug}-${item.year}`}>
                      <td className="px-3 py-2.5">{item.state}</td>
                      <td className="px-3 py-2.5">{item.title}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{item.year}</td>
                      <td className="px-3 py-2.5"><span className={`report-pill ${item.status.toLowerCase()}`}>{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <HomeIndiaMap cases={covered.map((item) => ({ code: item.code, slug: item.slug, title: item.title, status: item.status }))} />
            </div>
          </div>
        </section>

        <section className="report-section" aria-labelledby="services">
          <div className="report-wrap">
            <h2 id="services" className="report-heading">Services</h2>
            <p className="report-sub">Research, analysis and reporting support.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => (
                <div key={service.title} className="report-card p-4">
                  <h3 className="text-[14.5px] font-semibold text-[var(--r-navy)]">{service.title}</h3>
                  <p className="mt-1 text-[13px] text-[var(--r-muted)]">{service.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-4"><Link href="/services" className="report-link">See all services</Link></p>
          </div>
        </section>

        <section className="report-section" aria-labelledby="selected-work">
          <div className="report-wrap">
            <h2 id="selected-work" className="report-heading">Selected case studies</h2>
            <p className="report-sub">Each case study opens the protected analysis workspace.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {selected.map((item) => (
                <Link key={item.slug} href={`/case-studies/${item.slug}`} className="report-card flex flex-col p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--r-teal-d)]">{item.stateName}</span>
                  <span className="mt-1 text-[15px] font-semibold text-[var(--r-navy)]">{item.title}</span>
                  <span className="mt-2 flex-1 text-[12.5px] text-[var(--r-muted)]">{item.summary}</span>
                  <span className="mt-3 text-[12px] font-semibold text-[var(--r-teal-d)]">View case study</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <ContactSection />
      </main>
    </>
  );
}
