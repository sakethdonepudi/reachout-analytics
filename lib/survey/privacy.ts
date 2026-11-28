/* Client-safe copy for survey dashboards. Source notes can mention survey
   tooling, form numbers or domains; none of those may reach a client payload. */

const REDACTIONS: RegExp[] = [
  /\bwpforms\b/gi,
  /\breachout ads desk\b/gi,
  /\bmeta ads manager\b/gi,
  /\bads manager\b/gi,
  /\bscreenshots?\b/gi,
  /\bform\s*#?\s*\d+\b/gi,
  /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:in|com|org|net|co|io)\b(?:\/[^\s,;)]*)?/gi,
  /[₹]\s*[\d,.]+/g,
  /\b(?:INR|Rs\.?)\s?[\d,.]+/gi,
  /\b(?:spend|spent|cost|cpm|cpc|cpr|billing|budget|payment)\b\s*[:·-]?\s*(?:[₹]?\s?[\d,.]+)?/gi,
];

/** Remove survey tooling, form numbers, domains, amounts and spend wording. */
export function clientText(value: unknown): string {
  let text = String(value ?? "");
  for (const pattern of REDACTIONS) text = text.replace(pattern, " ");
  text = text.replace(/\b(?:from|at|via|through)\s+(?=[(),.;:]|$)/gi, "").replace(/\b(?:from|at|via|through)\s*$/i, "");
  return text.replace(/\(\s*\)|\[\s*\]/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;:])/g, "$1").replace(/^[\s·,:;-]+|[\s·,:;-]+$/g, "").trim();
}

/** Sanitize a free-text value that may be absent. */
export function clientNote(value: unknown): string | undefined {
  const text = clientText(value);
  return text || undefined;
}
