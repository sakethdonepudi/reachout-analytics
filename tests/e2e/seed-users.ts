/**
 * Seeds the five login-matrix personas into the local test database.
 * Run with: npx tsx --conditions react-server tests/e2e/seed-users.ts
 * Credentials are written to .context/e2e-users.json (ignored by git) and
 * never printed.
 */
import { MongoClient } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { hashPassword } from "../../lib/users";
import { sealSecret } from "../../lib/secure-box";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required");
const mongoUri: string = uri;
const dbName = process.env.MONGODB_DB || "reachout";

const PASSWORD = "E2e!Passw0rd-9f3Kx2";
const CHANGED_PASSWORD = "E2e!Changed-9f3Kx2";
const SECRET = "JBSWY3DPEHPK3PXP";

type Persona = {
  key: string;
  username: string;
  displayName: string;
  role: "owner" | "client";
  kind: "password" | "totp" | "change" | "enroll";
  totpEnabled: boolean;
  totpRequired: boolean;
  mustChangePassword: boolean;
};

const PERSONAS: Persona[] = [
  { key: "owner", username: "e2e.owner", displayName: "E2E Owner", role: "owner", kind: "totp", totpEnabled: true, totpRequired: true, mustChangePassword: false },
  { key: "clientOff", username: "e2e.client.off", displayName: "E2E Client", role: "client", kind: "password", totpEnabled: false, totpRequired: false, mustChangePassword: false },
  { key: "client2fa", username: "e2e.client.2fa", displayName: "E2E Client 2FA", role: "client", kind: "totp", totpEnabled: true, totpRequired: false, mustChangePassword: false },
  { key: "clientChange", username: "e2e.client.change", displayName: "E2E Client Change", role: "client", kind: "change", totpEnabled: false, totpRequired: false, mustChangePassword: true },
  { key: "clientEnroll", username: "e2e.client.enroll", displayName: "E2E Client Enroll", role: "client", kind: "enroll", totpEnabled: false, totpRequired: true, mustChangePassword: false },
];

async function main() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const users: any = db.collection("users");
  const now = new Date();

  for (const persona of PERSONAS) {
    const existing = await users.findOne({ username: persona.username });
    const base = {
      username: persona.username,
      displayName: persona.displayName,
      organisation: "E2E",
      role: persona.role,
      passwordHash: await hashPassword(PASSWORD),
      totpSecret: persona.totpEnabled ? sealSecret(SECRET) : null,
      totpEnabled: persona.totpEnabled,
      totpRequired: persona.totpRequired,
      recoveryCodes: [],
      lastTotpStep: null,
      status: "active",
      mustChangePassword: persona.mustChangePassword,
      failedLogins: 0,
      lockedUntil: null,
      knownDevices: [],
    };
    if (existing) {
      await users.updateOne({ _id: existing._id }, { $set: base });
    } else {
      await users.insertOne({
        _id: `e2e-${persona.key}`,
        ...base,
        createdBy: null,
        createdAt: now,
        lastLoginAt: null,
        lastLoginDevice: null,
      });
    }
  }

  mkdirSync(".context", { recursive: true });
  writeFileSync(
    ".context/e2e-users.json",
    JSON.stringify({
      baseUrl: process.env.E2E_BASE_URL || "http://localhost:3101",
      password: PASSWORD,
      changedPassword: CHANGED_PASSWORD,
      totpSecret: SECRET,
      users: Object.fromEntries(PERSONAS.map((persona) => [persona.key, {
        username: persona.username,
        role: persona.role,
        kind: persona.kind,
      }])),
    }, null, 2),
  );

  console.log(`seeded ${PERSONAS.length} login-matrix personas`);
  await client.close();
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
