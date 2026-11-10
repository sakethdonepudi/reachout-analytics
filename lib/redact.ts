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

export function safeLog(label: string, value: unknown) {
  // Server logs only. Never pass raw request bodies or headers here.
  console.error(label, JSON.stringify(redact(value)));
}
