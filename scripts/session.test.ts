/* Session idle and heartbeat tests. Run with MONGODB_URI + ADMIN_SESSION_SECRET. */

import { MongoClient } from "mongodb";
import { createSession, getSessionByToken, grantSessionGrace, clearSessionGrace, heartbeat, revokeSession, IDLE_MS } from "@/lib/auth";

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
  const identity = { userId: "user-test", role: "owner" as const, displayName: "Test Owner", scope: { caseStudies: [], states: [], parties: [] } };

  console.log("\n1. Idle timeout is authoritative");
  const token = await createSession(identity);
  const parsed = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
  await sessions.updateOne({ _id: parsed.sid }, { $set: { lastSeen: new Date(Date.now() - IDLE_MS - 1000) } });
  ok("session dies after 3 minutes idle", (await getSessionByToken(token)) === null);
  ok("expired session document removed", (await sessions.countDocuments({ _id: parsed.sid })) === 0);

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

  console.log("\n3. Meta connect grace survives the Facebook trip");
  const token3 = await createSession(identity);
  const parsed3 = JSON.parse(Buffer.from(token3.split(".")[0], "base64url").toString());
  await sessions.updateOne({ _id: parsed3.sid }, { $set: { lastSeen: new Date(Date.now() - IDLE_MS - 60_000) } });
  ok("idle session is dead without grace", (await getSessionByToken(token3)) === null);
  const token4 = await createSession(identity);
  const parsed4 = JSON.parse(Buffer.from(token4.split(".")[0], "base64url").toString());
  await sessions.updateOne({ _id: parsed4.sid }, { $set: { lastSeen: new Date(Date.now() - IDLE_MS - 60_000) } });
  await grantSessionGrace(parsed4.sid, 10 * 60 * 1000);
  ok("grace keeps the session alive", (await getSessionByToken(token4)) !== null);
  await clearSessionGrace(parsed4.sid);
  ok("grace is cleared after the callback", (await getSessionByToken(token4)) === null);

  console.log("\n4. Sign out ends the session");
  await revokeSession(token2);
  ok("revoked session is rejected", (await getSessionByToken(token2)) === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  await client.close();
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
