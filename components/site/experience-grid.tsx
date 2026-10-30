import Reveal from "@/components/site/reveal";
import {
  EXPERIENCE_ORGANISATIONS,
  RELATIONSHIP_LABEL,
  type ExperienceRelationship,
} from "@/lib/experience";
import { cn } from "@/lib/utils";

const BADGE: Record<ExperienceRelationship, string> = {
  consulting: "border-saffron/30 bg-saffron/10 text-saffron-2",
  training: "border-[#2fbf4a]/30 bg-[#2fbf4a]/10 text-[#238b39] dark:text-[#65df7a]",
};

function relationshipLabel(relationships: ExperienceRelationship[]) {
  if (relationships.length === 2) return "Consulting + training";
  return RELATIONSHIP_LABEL[relationships[0]];
}

function relationshipClass(relationships: ExperienceRelationship[]) {
  if (relationships.length === 2) {
    return "border-border bg-[linear-gradient(90deg,rgba(245,138,36,.10),rgba(47,191,74,.10))] text-foreground/70";
  }
  return BADGE[relationships[0]];
}

export default function ExperienceLogoGrid() {
  return (
    <div>
      <ul className="grid grid-cols-1 gap-2.5 min-[375px]:grid-cols-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {EXPERIENCE_ORGANISATIONS.map((logo, i) => (
          <li key={logo.name} className="h-full">
            <Reveal delay={i * 35} className="h-full">
              <figure
                tabIndex={0}
                className="experience-card group flex min-h-[170px] h-full flex-col rounded-2xl border border-border bg-card/75 p-2.5 transition duration-300 hover:-translate-y-1 hover:border-saffron/35 hover:shadow-[0_18px_38px_-28px_rgba(15,20,30,.38)] focus-visible:-translate-y-1 focus-visible:border-saffron/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-[178px] sm:p-3.5"
              >
                <div className="flex h-[78px] items-center justify-center overflow-hidden rounded-xl border border-black/[.055] bg-[#fbfaf7] px-3 py-2.5 sm:h-[88px] sm:px-4">
                  {/* Local, unoptimised SVG keeps the original brand colours and proportions. */}
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    width={logo.width}
                    height={logo.height}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-auto max-h-full w-auto max-w-full object-contain"
                    style={{ maxHeight: logo.opticalHeight }}
                  />
                </div>
                <figcaption className="mt-2.5 flex flex-1 flex-col items-center justify-between gap-2 text-center sm:mt-3">
                  <span className="font-display text-[12.5px] font-semibold tracking-[-0.015em] text-foreground sm:text-[13.5px]">{logo.name}</span>
                  <span className="flex justify-center">
                    <span className={cn("whitespace-nowrap rounded-full border px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.06em] sm:text-[9px]", relationshipClass(logo.relationships))}>
                      {relationshipLabel(logo.relationships)}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="mt-5 max-w-3xl text-[11.5px] leading-relaxed text-muted-foreground">
        Organisation names and marks identify leadership-team experience only. They do not imply partnership, sponsorship, endorsement or an ongoing ReachOut client relationship.
      </p>
    </div>
  );
}
