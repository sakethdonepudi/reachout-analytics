import { migrateClientScopes } from "@/lib/users";

(async () => {
  const count = await migrateClientScopes();
  console.log(`Removed clientScope from ${count} client account${count === 1 ? "" : "s"}.`);
  process.exit(0);
})().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
