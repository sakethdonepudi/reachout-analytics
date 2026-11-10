import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedToken = {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: string;
};

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 base64-encoded bytes");
  return bytes;
}

export function encryptToken(token: string, keyVersion = process.env.TOKEN_KEY_VERSION || "v1"): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    keyVersion,
  };
}

export function decryptToken(record: EncryptedToken): string {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

/** Decryption must never escape as an unhandled 500. Callers show "Reconnect Meta". */
export function tryDecryptToken(record: EncryptedToken | null | undefined): { ok: true; token: string } | { ok: false; reason: "reconnect" } {
  if (!record?.ciphertext || !record.iv || !record.tag) return { ok: false, reason: "reconnect" };
  try {
    return { ok: true, token: decryptToken(record) };
  } catch {
    return { ok: false, reason: "reconnect" };
  }
}
