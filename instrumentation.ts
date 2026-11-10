export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionSecrets } = await import("@/lib/security-config");
  assertProductionSecrets();
}
