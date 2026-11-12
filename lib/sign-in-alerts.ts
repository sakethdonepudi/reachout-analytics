import "server-only";

import { createHash } from "node:crypto";
import { getMongo } from "@/lib/mongodb";
import type { UserDoc } from "@/lib/users";

function browserOs(userAgent: string): string {
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : /Firefox\//.test(userAgent) ? "Firefox" : "Browser";
  const os = /Windows/.test(userAgent) ? "Windows" : /Mac OS X/.test(userAgent) ? "macOS" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Linux/.test(userAgent) ? "Linux" : "device";
  return `${browser} on ${os}`;
}

export function deviceFingerprint(req: Request): string {
  const ua = req.headers.get("user-agent") ?? "";
  const language = req.headers.get("accept-language") ?? "";
  const platform = req.headers.get("sec-ch-ua-platform") ?? "";
  return createHash("sha256").update(`${ua}|${language}|${platform}`).digest("hex");
}

export function maskedIp(req: Request): string {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  if (raw.includes(".")) return `${raw.split(".").slice(0, 3).join(".")}.0/24`;
  if (raw.includes(":")) return `${raw.split(":").slice(0, 4).join(":")}::/64`;
  return "unknown";
}

/** A new browser/device produces one owner notification, never a raw UA + IP pair. */
export async function alertNewDevice(user: UserDoc, req: Request): Promise<boolean> {
  const fingerprint = deviceFingerprint(req);
  if ((user.knownDevices ?? []).includes(fingerprint)) return false;
  await (async () => {
    const promise = getMongo();
    if (!promise) return;
    const client = await promise;
    await client.db(process.env.MONGODB_DB || "reachout").collection<{ _id: string }>("users").updateOne({ _id: user._id }, { $addToSet: { knownDevices: fingerprint } });
  })().catch(() => {});
  const browser = browserOs(req.headers.get("user-agent") ?? "");
  const ip = maskedIp(req);
  const at = new Date().toISOString();
  await (async () => {
    const promise = getMongo();
    if (!promise) return;
    const client = await promise;
    const notification = {
      _id: globalThis.crypto.randomUUID(),
      kind: "new_device",
      severity: "info",
      title: `New sign-in: ${user.username} (${user.role})`,
      body: `${browser} · ${ip} · ${new Date(at).toLocaleString("en-IN")}`,
      createdAt: at,
      read: false,
      username: user.username,
      role: user.role,
      device: browser,
      ipPrefix: ip,
      signInAt: at,
    };
    await client.db(process.env.MONGODB_DB || "reachout").collection<{ _id: string }>("owner_notifications").insertOne(notification);
  })().catch(() => {});
  return true;
}
