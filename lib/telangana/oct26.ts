import bundle from "@/lib/data/telangana/oct26.json";
export * from "./constants";
import type { Oct26 } from "./constants";

export const DATA = bundle as unknown as Oct26;

/* ---------------- system lookups ---------------- */
export const districtNames = () => DATA.districts.map((d) => d.name).sort((a, b) => a.localeCompare(b));
export const acsOfDistrict = (name: string | null) =>
  name ? DATA.acs.filter((a) => a.district === name) : DATA.acs;
export const acByNo = (no: number | null) => (no === null ? null : DATA.acs.find((a) => a.no === no) ?? null);
