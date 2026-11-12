const SECRET_KEY = /token|secret|password|cookie|authorization|api[_-]?key|client[_-]?secret/i;

export function maskEmail(value: string): string {
  const email = String(value ?? "");
  const at = email.indexOf("@");
  if (at < 1) return email ? "***" : "";
  const local = email.slice(0, at);
  return `${local.slice(0, 1)}***${local.length > 2 ? local.slice(-1) : ""}@${email.slice(at + 1)}`;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return maskEmail(value);
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(item, depth + 1);
    }
    return out;
  }
  return "[unserialisable]";
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SECRET_PAIR_PATTERN = /\b(access_token|refresh_token|token|secret|password|api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

/** Redact free-form error text: embedded emails, key/value secrets and bearers. */
export function redactText(value: unknown): string {
  let text = value == null ? "" : String(value);
  text = text.replace(EMAIL_PATTERN, (email) => maskEmail(email));
  text = text.replace(BEARER_PATTERN, "Bearer [redacted]");
  text = text.replace(SECRET_PAIR_PATTERN, (_match, key) => `${key}=[redacted]`);
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}

export function safeLog(label: string, value: unknown) {
  // Server logs only. Never pass raw request bodies or headers here.
  console.error(label, JSON.stringify(redact(value)));
}
