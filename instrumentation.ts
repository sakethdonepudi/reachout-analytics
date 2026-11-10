export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionSecrets, metaConfigWarning } = await import("@/lib/security-config");
  assertProductionSecrets();
  const warning = metaConfigWarning();
  if (warning) console.warn(`[security-config] ${warning}`);
}
