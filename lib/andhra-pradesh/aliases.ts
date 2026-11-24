const AP_DISTRICT_ALIAS: Record<string, string> = {
  Anantapur: "Ananthapuramu",
  ASR: "Alluri Sitharama Raju",
  Kadapa: "YSR Kadapa",
  "YSR Kadapa": "YSR Kadapa",
  "Alluri Sitharama Raju": "Alluri Sitharama Raju",
  "Parvathipuram Manyam": "Parvathipuram Manyam",
};

const AP_AC_ALIAS: Record<string, string> = {
  Cheepurupalle: "Cheepurupalli",
  Yelamanchili: "Elamanchili",
  Palacole: "Palakollu",
  Ungutur: "Unguturu",
  Ponnur: "Ponnuru",
  Satyavedu: "Sathyavedu",
  Tadpatri: "Tadipatri",
};

export function canonicalApDistrict(name: string): string {
  return AP_DISTRICT_ALIAS[name] ?? name;
}

export function canonicalApAcName(name: string): string {
  return AP_AC_ALIAS[name] ?? name.replace(/\s*\((SC|ST)\)\s*$/i, "");
}

export function splitApAcLabel(label: string): { no: number | null; name: string } {
  const match = /^\s*(\d{1,3})\s+(.*)$/.exec(label);
  if (!match) return { no: null, name: canonicalApAcName(label) };
  return { no: Number(match[1]), name: canonicalApAcName(match[2]) };
}
