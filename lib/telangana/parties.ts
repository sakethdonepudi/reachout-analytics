/* =====================================================================
   Telangana party registry.

   One shared normalisation map for every Telangana surface (imports,
   aggregates, charts, map fills). Raw labels are always preserved on the
   record; this only decides which series a value belongs to.
   ===================================================================== */

export const TG_PARTIES = ["BRS", "INC", "BJP", "AIMIM", "TDP", "JSP", "Others", "NOTA"] as const;
export type TgParty = (typeof TG_PARTIES)[number];

/** Parties that can lead an assembly / appear in the 2028 scenario. */
export const TG_CONTESTED = ["BRS", "INC", "BJP", "AIMIM", "TDP", "JSP", "Others"] as const;

export type PartyMeta = {
  id: TgParty;
  label: string;
  short: string;
  /** fill used on the map and in charts (never reused for another party) */
  color: string;
  /** slightly deeper tone for text/legend on light surfaces */
  ink: string;
  /** raw source labels that map here */
  aliases: string[];
};

export const PARTY_META: Record<TgParty, PartyMeta> = {
  BRS: {
    id: "BRS", label: "BRS", short: "BRS", color: "#e5007d", ink: "#b8005f",
    aliases: ["BRS", "TRS", "BHRS", "Bharat Rashtra Samithi", "Telangana Rashtra Samithi"],
  },
  INC: {
    id: "INC", label: "Congress", short: "INC", color: "#1f6fd0", ink: "#15539c",
    aliases: ["INC", "Congress", "Indian National Congress", "INC(I)"],
  },
  BJP: {
    id: "BJP", label: "BJP", short: "BJP", color: "#e87511", ink: "#b55607",
    aliases: ["BJP", "Bharatiya Janata Party"],
  },
  AIMIM: {
    id: "AIMIM", label: "AIMIM", short: "AIMIM", color: "#128a3f", ink: "#0b612c",
    aliases: ["AIMIM", "Majlis", "All India Majlis-e-Ittehadul Muslimeen"],
  },
  TDP: {
    id: "TDP", label: "TDP", short: "TDP", color: "#e3b505", ink: "#8f6f00",
    aliases: ["TDP", "Telugu Desam Party"],
  },
  JSP: {
    id: "JSP", label: "Jana Sena", short: "JSP", color: "#d7263d", ink: "#a11426",
    aliases: ["JSP", "JNP", "Janasena", "Jana Sena", "JnP"],
  },
  Others: {
    id: "Others", label: "Others", short: "OTH", color: "#8a94a3", ink: "#5f6875",
    aliases: ["Others", "Other", "Independent", "IND"],
  },
  NOTA: {
    id: "NOTA", label: "NOTA", short: "NOTA", color: "#4b5563", ink: "#374151",
    aliases: ["NOTA", "None", "None of the above"],
  },
};

const ALIAS_INDEX = new Map<string, TgParty>();
for (const p of Object.values(PARTY_META)) {
  ALIAS_INDEX.set(p.id.toLowerCase(), p.id);
  for (const a of p.aliases) ALIAS_INDEX.set(a.trim().toLowerCase(), p.id);
}

/** Canonical party id. Unknown labels become `Others` (never invented). */
export function canonicalTgParty(raw: unknown): TgParty {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return "Others";
  return ALIAS_INDEX.get(key) ?? "Others";
}

/** The raw source label a value carried (for provenance columns). */
export function isKnownTgParty(raw: unknown): boolean {
  const key = String(raw ?? "").trim().toLowerCase();
  return !!key && ALIAS_INDEX.has(key);
}

export const partyMeta = (id: string): PartyMeta => PARTY_META[(id as TgParty)] ?? PARTY_META.Others;
