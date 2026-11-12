/* Session idle and heartbeat tests. Run with MONGODB_URI + ADMIN_SESSION_SECRET. */

import { MongoClient } from "mongodb";
import { createSession, getSessionByToken, heartbeat, revokeSession, IDLE_MS } from "@/lib/auth";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || !process.env.ADMIN_SESSION_SECRET) { console.log("MONGODB_URI and ADMIN_SESSION_SECRET are required"); process.exitCode = 1; return; }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "reachout");
  const sessions = db.collection("sessions");
  await sessions.deleteMany({});
  const identity = { userId: "user-test", role: "owner" as const, displayName: "Test Owner" };

  console.log("\n1. Idle timeout is authoritative");
  const token = await createSession(identity);
  const parsed = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
  await sessions.updateOne({ _id: parsed.sid }, { $set: { lastSeen: new Date(Date.now() - IDLE_MS - 1000) } });
  ok("session dies after 10 minutes idle", (await getSessionByToken(token)) === null);
  ok("expired session document removed", (await sessions.countDocuments({ _id: parsed.sid })) === 0);

  console.log("\n1b. Ten-minute boundary");
  const near = await createSession(identity);
  const nearParsed = JSON.parse(Buffer.from(near.split(".")[0], "base64url").toString());
  await sessions.updateOne({ _id: nearParsed.sid }, { $set: { lastSeen: new Date(Date.now() - (10 * 60 * 1000 - 1000)) } });
  ok("session survives 9:59", (await getSessionByToken(near)) !== null);
  await sessions.updateOne({ _id: nearParsed.sid }, { $set: { lastSeen: new Date(Date.now() - (10 * 60 * 1000 + 1000)) } });
  ok("session dies at 10:01", (await getSessionByToken(near)) === null);

  console.log("\n2. Polling does not extend a session");
  const token2 = await createSession(identity);
  const parsed2 = JSON.parse(Buffer.from(token2.split(".")[0], "base64url").toString());
  const before = (await sessions.findOne({ _id: parsed2.sid }))?.lastSeen?.getTime();
  for (let index = 0; index < 5; index += 1) await getSessionByToken(token2);
  const after = (await sessions.findOne({ _id: parsed2.sid }))?.lastSeen?.getTime();
  ok("reads leave lastSeen unchanged", before === after);
  await heartbeat(parsed2.sid);
  const beat = (await sessions.findOne({ _id: parsed2.sid }))?.lastSeen?.getTime();
  ok("heartbeat extends lastSeen", Boolean(beat && beat > (before ?? 0)));

  console.log("\n3. Sign out ends the session");
  await revokeSession(token2);
  ok("revoked session is rejected", (await getSessionByToken(token2)) === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  await client.close();
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
