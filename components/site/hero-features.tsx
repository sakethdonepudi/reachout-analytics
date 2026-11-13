import { BarChart3, Compass, Users } from "lucide-react";
import Reveal from "@/components/site/reveal";

const FEATURES = [
  { Icon: BarChart3, title: "Election Analysis", desc: "Survey design, constituency modelling and seat-level strategy, built on field data." },
  { Icon: Users, title: "Voter Insights", desc: "Segmentation, sentiment and targeting drawn from ongoing voter research." },
  { Icon: Compass, title: "Regional Intelligence", desc: "State and district research that helps campaigns focus where it counts." },
];

/** The three capability cards, moved out of the hero into their own section. */
export default function HeroFeatures() {
  return (
    <section id="capabilities" className="relative z-10 border-t border-border bg-background">
      <div className="mx-auto max-w-[1280px] px-6 py-16 sm:px-10 sm:py-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, desc }, index) => (
            <Reveal key={title} delay={index * 70} className="h-full">
              <div className="h-full rounded-2xl border border-border bg-card/70 p-5 transition-colors hover:border-teal/40">
                <span className="mb-3 grid size-9 place-items-center rounded-xl border border-border bg-elevated text-teal-deep">
                  <Icon className="size-4" />
                </span>
                <h2 className="font-display text-[15px] font-semibold text-foreground">{title}</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
