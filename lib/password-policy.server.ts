import "server-only";

import { COMMON_PASSWORDS } from "@/lib/common-passwords-10k";

const SHAPE_RULES: RegExp[] = [
  /^(.)\1{7,}$/,
  /^(0123|1234|2345|3456|4567|5678|6789|7890|9876|8765|7654|6543|5432|4321|3210){2,}$/,
  /^(qwerty|asdf|zxcv|qazwsx|poiuyt)+/,
  /^(password|admin|welcome|letmein|secret|iloveyou)[\d!@#$%^&*._-]*$/,
];

export type PasswordCheck = { ok: boolean; error?: string };

export function checkPassword(password: string, username: string): PasswordCheck {
  const value = String(password ?? "");
  if (value.length < 12) return { ok: false, error: "Use at least 12 characters." };
  if (value.length > 256) return { ok: false, error: "Use 256 characters or fewer." };
  const lower = value.toLowerCase();
  const user = String(username ?? "").toLowerCase();
  if (user.length >= 3 && lower.includes(user)) return { ok: false, error: "The password cannot contain the username." };
  if (COMMON_PASSWORDS.has(lower)) return { ok: false, error: "This password is too common." };
  if (SHAPE_RULES.some((rule) => rule.test(lower))) return { ok: false, error: "This password is too common." };
  return { ok: true };
}
