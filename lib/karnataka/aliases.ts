/** Survey names and source aliases for Karnataka and Telangana copy. */
const KA_DISTRICT_ALIAS: Record<string, string> = {
  Bangalore: "Bengaluru Urban",
  "Bangalore Urban": "Bengaluru Urban",
  Belgaum: "Belagavi",
  Bijapur: "Vijayapura",
  Gulbarga: "Kalaburagi",
  Mysore: "Mysuru",
  Shimoga: "Shivamogga",
  Tumkur: "Tumakuru",
  Chickmagalur: "Chikkamagaluru",
  Chikmagalur: "Chikkamagaluru",
  Chamrajnagar: "Chamarajanagar",
  Chikkaballapur: "Chikkaballapura",
  Vijayanagar: "Vijayanagara",
};

const KA_AC_ALIAS: Record<string, string> = {
  Chiknayakanhalli: "Chikkanayakanahalli",
  Jevargi: "Jewargi",
  Shrirangapattana: "Srirangapatna",
  "K.R.Pura": "K.R. Pura",
  "Hubli-Dharwad- West": "Hubli-Dharwad-West",
};

export function canonicalKaDistrict(name: string): string {
  return KA_DISTRICT_ALIAS[name] ?? name;
}

export function canonicalKaAcName(name: string): string {
  return KA_AC_ALIAS[name] ?? name.replace(/\s*\((SC|ST)\)\s*$/i, "").replace(/\s+/g, " ").trim();
}

export function splitKaAcLabel(label: string): { no: number | null; name: string } {
  const match = /^\s*(\d{1,3})\s+(.*)$/.exec(label);
  if (!match) return { no: null, name: canonicalKaAcName(label) };
  return { no: Number(match[1]), name: canonicalKaAcName(match[2]) };
}
