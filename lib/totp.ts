import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** RFC 6238 TOTP: SHA-1, 6 digits, 30-second step, +/-1 step. */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD = 30;
const DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0, value = 0, output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpStep(now = Date.now()): number {
  return Math.floor(now / 1000 / PERIOD);
}

export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 0x100000000), 0);
  counter.writeUInt32BE(step >>> 0, 4);
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export type TotpCheck = { ok: boolean; step: number };

/** Reject replay: the matched step must be greater than the last used step. */
export function verifyTotp(secret: string, code: string, lastStep: number | null | undefined, now = Date.now()): TotpCheck {
  const cleaned = String(code ?? "").replace(/\D/g, "");
  const current = totpStep(now);
  if (cleaned.length !== DIGITS) return { ok: false, step: current };
  for (const offset of [0, -1, 1]) {
    const step = current + offset;
    if (step <= (lastStep ?? -1)) continue;
    const expected = totpCode(secret, step);
    const a = Buffer.from(expected);
    const b = Buffer.from(cleaned);
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true, step };
  }
  return { ok: false, step: current };
}

export function otpauthUrl(username: string, secret: string): string {
  const label = encodeURIComponent(`ReachOut:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=ReachOut&algorithm=SHA1&digits=6&period=30`;
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const raw = base32Encode(randomBytes(10)).slice(0, 10);
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function normaliseRecoveryCode(value: string): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z2-7]/g, "");
}
