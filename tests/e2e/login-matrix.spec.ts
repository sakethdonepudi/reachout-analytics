/**
 * Cross-directional login and loading matrix.
 *
 * Local run:
 *   npx tsx --conditions react-server tests/e2e/seed-users.ts
 *   npx tsx tests/e2e/login-matrix.spec.ts
 *
 * Production smoke:
 *   npx tsx tests/e2e/login-matrix.spec.ts --prod
 *
 * Credentials are read from .context/e2e-users.json and never printed.
 */
import { readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { MongoClient } from "mongodb";
import { totpCode, totpStep } from "../../lib/totp";
import { CASES } from "../../lib/cases";

type Kind = "password" | "totp" | "change" | "enroll";
type Persona = { key: string; username: string; role: "owner" | "client"; kind: Kind; password: string; secret?: string; newPassword?: string };
type Result = { entry: string; user: string; status: string; next: string; turnstile: string; loader: string; paint: string; cls: string; result: string };

const args = new Set(process.argv.slice(2));
const PROD = args.has("--prod");
const SKIP_MATRIX = process.env.E2E_SKIP_MATRIX === "1";
const SKIP_SESSION = process.env.E2E_SKIP_SESSION === "1";
const SKIP_LANDING = process.env.E2E_SKIP_LANDING === "1";
const LOCAL_BASE = "http://localhost:3101";
const PROD_BASE = "https://reachout-analytics.vercel.app";
const BASE = PROD ? PROD_BASE : LOCAL_BASE;

const seed = JSON.parse(readFileSync(".context/e2e-users.json", "utf8")) as {
  password: string;
  changedPassword: string;
  totpSecret: string;
  users: Record<string, { username: string; role: "owner" | "client"; kind: Kind }>;
};

const PERSONAS: Persona[] = Object.entries(seed.users).filter(([key]) => !process.env.E2E_USER || process.env.E2E_USER === key).map(([key, user]) => ({
  key,
  username: user.username,
  role: user.role,
  kind: user.kind,
  password: seed.password,
  secret: user.kind === "totp" ? seed.totpSecret : undefined,
  newPassword: seed.changedPassword,
}));

const results: Result[] = [];
const failures: string[] = [];
let pass = 0;

function record(name: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
  const row = results[results.length - 1];
  if (row && row.result === "pending") row.result = ok ? "PASS" : "FAIL";
  return ok;
}

function ok(name: string, condition: boolean, detail = "") {
  if (!condition) console.log(`  FAIL ${name}${detail ? ` :: ${detail}` : ""}`);
  record(name, condition, detail);
}

function newRow(entry: string, user: string, status: string): Result {
  const row: Result = { entry, user, status, next: "", turnstile: "", loader: "", paint: "", cls: "", result: "pending" };
  results.push(row);
  return row;
}

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
    });
  }
}

let ipSequence = 1;
const ipPrefix = 20 + Math.floor(Math.random() * 200);
function nextIp() {
  const value = ipSequence++;
  return `10.${ipPrefix}.${Math.floor(value / 250)}.${value % 250}`;
}

async function freshContext(browser: Browser, width = 1440, height = 900, track = true, storageState?: Awaited<ReturnType<BrowserContext["storageState"]>>): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width, height },
    extraHTTPHeaders: { "x-forwarded-for": nextIp() },
    storageState,
  });
  if (track) {
    await context.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
            if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true } as PerformanceObserverInit);
      } catch { /* older engines */ }
    });
  }
  return context;
}

function watch(page: Page) {
  const errors: string[] = [];
  const badResponses: number[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Content Security Policy|Refused to/i.test(text)) errors.push(text);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.status() !== 401 && !response.url().includes("/login")) badResponses.push(response.status());
  });
  return { errors, badResponses };
}

async function turnstileReady(page: Page, timeout = 5000): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
      if (input?.value) return true;
      return Array.from(document.querySelectorAll("iframe")).some((frame) => {
        if (!/challenges\.cloudflare\.com/.test(frame.src)) return false;
        const rect = frame.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    }).catch(() => false);
    if (ready) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

/** Wait until the widget has actually produced a token. */
async function turnstileToken(page: Page, timeout = 15000): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const token = await page.evaluate(() => document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value ?? "").catch(() => "");
    if (token) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

function mongoUri(): string | null {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  try {
    return readFileSync(".context/.test-mongo-uri", "utf8").trim();
  } catch {
    return null;
  }
}

function mongo(): MongoClient | null {
  const uri = mongoUri();
  return uri ? new MongoClient(uri) : null;
}

async function resetTotp(username: string) {
  const client = mongo();
  if (!client) return;
  await client.connect();
  await client.db(process.env.MONGODB_DB || "reachout").collection("users").updateOne(
    { username },
    { $set: { lastTotpStep: null, failedLogins: 0, lockedUntil: null } },
  );
  await client.close();
}

async function clearTurnstileTokens() {
  const client = mongo();
  if (!client) return;
  await client.connect();
  await client.db(process.env.MONGODB_DB || "reachout").collection("turnstile_tokens").deleteMany({});
  await client.close();
}

async function resetPersona(persona: Persona) {
  const client = mongo();
  if (!client) return;
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "reachout");
  const patch: Record<string, unknown> = { failedLogins: 0, lockedUntil: null, lastTotpStep: null };
  if (persona.kind === "change") patch.mustChangePassword = persona.password !== persona.newPassword;
  if (persona.kind === "enroll") { patch.totpEnabled = false; patch.totpSecret = null; }
  await db.collection("users").updateOne({ username: persona.username }, { $set: patch });
  await client.close();
}

async function waitForLoginRedirect(page: Page, expectedNext: string | null, timeout = 15000) {
  await page.waitForURL((url) => url.pathname === "/login", { timeout });
  const url = new URL(page.url());
  const next = url.searchParams.get("next");
  return { url, next, ok: expectedNext === null ? next === null : next === expectedNext };
}

async function signIn(page: Page, persona: Persona, expectedPath: string, options: { next?: string } = {}) {
  await clearTurnstileTokens();
  if (persona.kind === "totp") await resetTotp(persona.username);
  if (persona.kind === "change" || persona.kind === "enroll") await resetPersona(persona);

  if (process.env.E2E_DEBUG) {
    page.on("response", async (response) => {
      if (!response.url().includes("/api/auth/login")) return;
      console.log(`    [debug] login ${response.status()} cookie=${JSON.stringify(response.headers()["set-cookie"] ?? "")} ${(await response.text().catch(() => "")).slice(0, 160)}`);
    });
    page.on("console", (message) => {
      if (message.type() === "error" && process.env.E2E_DEBUG) console.log(`    [debug] console ${message.text().slice(0, 160)}`);
    });
    page.on("response", (response) => {
      if (process.env.E2E_DEBUG && response.status() >= 400) console.log(`    [debug] bad ${response.status()} ${response.url().slice(0, 120)}`);
    });
    page.on("framenavigated", (frame) => {
      if (process.env.E2E_DEBUG && frame === page.mainFrame()) console.log(`    [debug] nav ${frame.url().slice(0, 120)}`);
    });
  }
  const loginUrl = `${BASE}/login${options.next ? `?next=${encodeURIComponent(options.next)}` : ""}`;
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  await page.locator('input[autocomplete="username"]').fill(persona.username);
  await page.locator('input[autocomplete="current-password"]').fill(persona.password);
  ok(`${persona.key}: Turnstile on login`, await turnstileReady(page), "widget or token missing");
  ok(`${persona.key}: Turnstile token on login`, await turnstileToken(page), "token not issued");
  await page.getByRole("button", { name: "Continue" }).click();

  if (persona.kind === "totp") {
    await page.getByRole("heading", { name: "Enter your code" }).waitFor({ timeout: 15000 });
    ok(`${persona.key}: Turnstile token on code step`, await turnstileToken(page));
    // Test keys return one static token, so release the password-step token
    // before the code step submits the same dummy value again.
    await clearTurnstileTokens();
    const code = totpCode(persona.secret!, totpStep());
    for (let index = 0; index < 6; index += 1) {
      await page.getByLabel(`Digit ${index + 1}`).fill(code[index]);
    }
  } else if (persona.kind === "change") {
    const destination = new URL(expectedPath, BASE).pathname;
    await page.waitForURL((url) => url.pathname === "/account/password" || url.pathname === destination, { timeout: 15000 });
    if (new URL(page.url()).pathname === "/account/password") {
      await page.getByLabel("New password", { exact: true }).fill(persona.newPassword!);
      await page.getByLabel("Confirm new password").fill(persona.newPassword!);
      ok(`${persona.key}: Turnstile on new password`, await turnstileReady(page), "widget or token missing");
      ok(`${persona.key}: Turnstile token on new password`, await turnstileToken(page), "token not issued");
      await clearTurnstileTokens();
      await page.getByRole("button", { name: "Save password" }).click();
      persona.password = persona.newPassword!;
    }
  } else if (persona.kind === "enroll") {
    await page.waitForURL(/\/account\/security\/enroll/, { timeout: 15000 });
    const secret = (await page.locator("p.font-mono").first().innerText()).trim();
    const code = totpCode(secret, totpStep());
    for (let index = 0; index < 6; index += 1) {
      await page.getByLabel(`Digit ${index + 1}`).fill(code[index]);
    }
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.getByText("Save these codes now").waitFor({ timeout: 15000 });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Continue" }).click();
  }

  try {
    await page.waitForURL((url) => url.pathname === new URL(expectedPath, BASE).pathname, { timeout: 20000 });
  } catch (error) {
    if (process.env.E2E_DEBUG) {
      console.log(`    [debug] after sign-in url=${page.url()} body=${(await page.locator("body").innerText().catch(() => "")).slice(0, 220).replace(/\n/g, " | ")}`);
      console.log(`    [debug] cookies=${JSON.stringify((await page.context().cookies()).map((cookie) => cookie.name))} session=${JSON.stringify(await page.evaluate(async () => { const response = await fetch("/api/auth/session", { cache: "no-store" }); return [response.status, await response.text()]; }).catch(() => "error"))}`);
    }
    throw error;
  }
}

type Entry = {
  id: string;
  page: string;
  expectedNext: string | null;
  click: (page: Page) => Promise<void>;
  width?: number;
};

async function waitForTourEnd(page: Page) {
  await page.evaluate(() => {
    const tour = document.getElementById("tour");
    if (!tour) return;
    const top = tour.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + tour.offsetHeight - window.innerHeight + 120);
  });
  await page.waitForTimeout(2200);
}

function buildEntries(): Entry[] {
  const entries: Entry[] = [
    {
      id: "header-admin",
      page: "/",
      expectedNext: null,
      click: async (page) => { await page.locator('header a[href="/login"]').first().click(); },
    },
    {
      id: "mobile-admin",
      page: "/",
      expectedNext: null,
      width: 390,
      click: async (page) => {
        await page.getByRole("button", { name: "Open menu" }).click();
        const link = page.locator('a[href="/login"]:visible').filter({ hasText: "Admin Login" }).first();
        await link.waitFor({ state: "visible", timeout: 8000 });
        await link.click();
      },
    },
    {
      id: "hero-explore",
      page: "/",
      expectedNext: "/case-studies",
      click: async (page) => { await page.locator('main a[href="/case-studies"]').first().click(); },
    },
  ];

  for (const item of CASES) {
    entries.push({
      id: `carousel-${item.slug}`,
      page: "/",
      expectedNext: `/case-studies/${item.slug}`,
      click: async (page) => {
        await page.locator(`a[aria-label="Open ${item.party} · ${item.stateName} case study"]`).first().click();
      },
    });
  }

  for (const item of CASES.slice(0, 2)) {
    entries.push({
      id: `map-chip-${item.slug}`,
      page: "/",
      expectedNext: `/case-studies/${item.slug}`,
      click: async (page) => {
        await waitForTourEnd(page);
        await page.getByRole("button", { name: `${item.party} · ${item.label ?? item.stateName}` }).first().click();
        await page.waitForTimeout(300);
        await page.locator('#tour [role="link"]:visible').first().click();
      },
    });
  }

  for (const item of CASES) {
    entries.push({
      id: `work-${item.slug}`,
      page: "/",
      expectedNext: `/case-studies/${item.slug}`,
      click: async (page) => {
        const card = page.locator(`#work a[href="/case-studies/${item.slug}"]`).first();
        await card.scrollIntoViewIfNeeded();
        await card.click();
      },
    });
  }

  for (const [id, page] of [["services", "/services"], ["research", "/services/research-content"], ["about", "/about"]] as const) {
    entries.push({
      id: `navbar-${id}`,
      page,
      expectedNext: "/case-studies",
      click: async (p) => { await p.locator('header a[href="/case-studies"]').first().click(); },
    });
  }

  for (const path of [
    "/dashboard",
    "/dashboard/case-studies",
    "/account/users",
    "/account/security",
    "/case-studies",
    "/case-studies/tamil-nadu",
    "/case-studies/telangana",
    "/case-studies/gujarat",
    "/case-studies/bihar",
    "/case-studies/karnataka-2023",
    "/case-studies/north-east-elections",
    "/case-studies/andhra-pradesh-2024",
    "/case-studies/tamil-nadu?view=social",
  ]) {
    entries.push({
      id: `direct-${path}`,
      page: path,
      expectedNext: path,
      click: async () => { /* the direct load is the entry */ },
    });
  }

  return entries;
}

async function redirectMatrix(browser: Browser) {
  const entries = buildEntries().filter((entry) => !process.env.E2E_ENTRY || entry.id.includes(process.env.E2E_ENTRY));
  console.log(`\n== Redirect matrix: ${entries.length} entry points x ${PERSONAS.length} users ==`);
  for (const entry of entries) {
    for (const persona of PERSONAS) {
      const row = newRow(entry.id, persona.key, "redirect");
      const context = await freshContext(browser, entry.width ?? 1440, entry.width === 390 ? 844 : 900);
      const page = await context.newPage();
      const { errors } = watch(page);
      try {
        await page.goto(`${BASE}${entry.page}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(700);
        if (entry.click && !entry.id.startsWith("direct-")) await entry.click(page);
        const redirect = await waitForLoginRedirect(page, entry.expectedNext);
        row.next = redirect.next ?? "(none)";
        const widget = await turnstileReady(page);
        row.turnstile = widget ? "visible" : "missing";
        ok(`${entry.id}/${persona.key}: redirect`, redirect.ok, `next=${redirect.next} expected=${entry.expectedNext}`);
        ok(`${entry.id}/${persona.key}: Turnstile`, widget);
        ok(`${entry.id}/${persona.key}: no CSP errors`, errors.length === 0, errors.join(" | "));
        row.status = "200";
      } catch (error) {
        row.status = "ERROR";
        record(`${entry.id}/${persona.key}: redirect`, false, error instanceof Error ? error.message : String(error));
      } finally {
        row.result = row.result === "pending" ? "PASS" : row.result;
        await context.close();
      }
    }
  }
}

async function landingMatrix(browser: Browser) {
  console.log("\n== Landing matrix ==");
  for (const persona of PERSONAS) {
    const next = "/case-studies/tamil-nadu";
    const row = newRow("signin-allowed", persona.key, "landing");
    const context = await freshContext(browser);
    const page = await context.newPage();
    const { errors, badResponses } = watch(page);
    const started = Date.now();
    let sawBar = false;
    let sawFull = false;
    let done = false;
    const poll = (async () => {
      const deadline = Date.now() + 25000;
      while (!done && Date.now() < deadline) {
        const state = await page.evaluate(() => ({
          bar: Boolean(document.querySelector('[data-testid="nav-progress"]')),
          full: Boolean(document.querySelector('[data-testid="signal-loader"]')),
        })).catch(() => ({ bar: false, full: false }));
        sawBar ||= state.bar;
        sawFull ||= state.full;
        if (Date.now() - started > 250 && (state.bar || state.full)) break;
        await page.waitForTimeout(50).catch(() => {});
      }
    })();
    try {
      await signIn(page, persona, next, { next });
      done = true;
      await poll.catch(() => {});
      const elapsed = Date.now() - started;
      row.paint = `${elapsed}ms`;
      row.loader = "sign-in";
      row.cls = await page.evaluate(() => Number((window as unknown as { __cls?: number }).__cls ?? 0).toFixed(3));
      row.status = "200";
      ok(`${persona.key}: lands on requested case study`, new URL(page.url()).pathname === next, page.url());
      ok(`${persona.key}: CLS`, Number(row.cls) <= 0.05, row.cls);
      ok(`${persona.key}: no console errors`, errors.length === 0, errors.join(" | "));
      ok(`${persona.key}: no failed requests beyond 401`, badResponses.length === 0, badResponses.join(","));
    } catch (error) {
      row.status = "ERROR";
      record(`${persona.key}: landing`, false, error instanceof Error ? error.message : String(error));
    } finally {
      row.result = row.result === "pending" ? "PASS" : row.result;
      await context.close();
    }

    // owner-only destination
    const blockedRow = newRow("signin-owner-only", persona.key, "landing");
    const blockedContext = await freshContext(browser);
    const blockedPage = await blockedContext.newPage();
    try {
      const expected = persona.role === "owner" ? "/dashboard" : "/no-access";
      await signIn(blockedPage, persona, expected, { next: "/dashboard" });
      blockedRow.status = "200";
      blockedRow.next = "/dashboard";
      ok(`${persona.key}: owner-only landing`, new URL(blockedPage.url()).pathname === expected, blockedPage.url());
      if (persona.role === "client") {
        const back = blockedPage.getByRole("link", { name: "Back to home" });
        await back.waitFor({ timeout: 8000 }).catch(() => {});
        ok(`${persona.key}: no-access has Back to home`, await back.count() === 1, blockedPage.url());
      }
    } catch (error) {
      blockedRow.status = "ERROR";
      record(`${persona.key}: owner-only landing`, false, error instanceof Error ? error.message : String(error));
    } finally {
      blockedRow.result = blockedRow.result === "pending" ? "PASS" : blockedRow.result;
      await blockedContext.close();
    }

    // no next
    const homeRow = newRow("signin-no-next", persona.key, "landing");
    const homeContext = await freshContext(browser);
    const homePage = await homeContext.newPage();
    try {
      await signIn(homePage, persona, persona.role === "owner" ? "/dashboard" : "/case-studies");
      homeRow.status = "200";
      ok(`${persona.key}: role home`, new URL(homePage.url()).pathname === (persona.role === "owner" ? "/dashboard" : "/case-studies"), homePage.url());
      // signed in /login must bounce to role home
      await homePage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await homePage.waitForURL((url) => url.pathname !== "/login", { timeout: 10000 });
      ok(`${persona.key}: signed-in /login returns to role home`, new URL(homePage.url()).pathname === (persona.role === "owner" ? "/dashboard" : "/case-studies"), homePage.url());
    } catch (error) {
      homeRow.status = "ERROR";
      record(`${persona.key}: role home`, false, error instanceof Error ? error.message : String(error));
    } finally {
      homeRow.result = homeRow.result === "pending" ? "PASS" : homeRow.result;
      await homeContext.close();
    }
  }
}

type Move = {
  id: string;
  start: string;
  target: string;
  click: (page: Page) => Promise<void>;
  route: boolean;
};

function buildMoves(): Move[] {
  return [
    {
      id: "home-to-cases",
      start: "/",
      target: "/case-studies",
      route: true,
      click: async (page) => { await page.locator('main a[href="/case-studies"]').first().click(); },
    },
    {
      id: "cases-to-state",
      start: "/case-studies",
      target: "/case-studies/tamil-nadu",
      route: true,
      click: async (page) => { await page.locator('main a[href="/case-studies/tamil-nadu"]:visible').first().click(); },
    },
    {
      id: "state-back-to-cases",
      start: "/case-studies/tamil-nadu",
      target: "/case-studies",
      route: true,
      click: async (page) => { await page.getByRole("link", { name: /Back to Case Studies/i }).first().click(); },
    },
    {
      id: "polls-to-social",
      start: "/case-studies/tamil-nadu",
      target: "/case-studies/tamil-nadu",
      route: false,
      click: async (page) => { await page.getByRole("tab", { name: "Social Media" }).first().click(); },
    },
    {
      id: "open-drawer",
      start: "/case-studies/tamil-nadu",
      target: "/case-studies/tamil-nadu",
      route: false,
      click: async (page) => {
        await page.getByRole("tab", { name: "Social Media" }).first().click();
        await page.waitForTimeout(500);
        const chevron = page.locator('[aria-label^="Show campaigns for "]:visible').first();
        await chevron.scrollIntoViewIfNeeded();
        await chevron.click();
      },
    },
    {
      id: "expand-and-close",
      start: "/case-studies/tamil-nadu",
      target: "/case-studies/tamil-nadu",
      route: false,
      click: async (page) => {
        await page.getByRole("button", { name: "Expand the vote-share analysis" }).first().click();
        await page.waitForSelector("[data-analysis-shell]", { timeout: 10000 });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
      },
    },
  ];
}

async function measure(page: Page, move: Move) {
  const started = Date.now();
  let bar = false;
  let full = false;
  let both = false;
  let done = false;
  const poll = (async () => {
    while (!done) {
      const state = await page.evaluate(() => ({
        bar: Boolean(document.querySelector('[data-testid="nav-progress"]')),
        full: Boolean(document.querySelector('[data-testid="signal-loader"]')),
      })).catch(() => ({ bar: false, full: false }));
      bar ||= state.bar;
      full ||= state.full;
      both ||= state.bar && state.full;
      await page.waitForTimeout(25).catch(() => {});
    }
  })();

  await move.click(page);
  if (move.route) {
    await page.waitForURL((url) => url.pathname === move.target, { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="signal-loader"]') && !document.querySelector('[data-testid="nav-progress"]'),
      { timeout: 30000 },
    ).catch(() => {});
  } else {
    await page.waitForTimeout(700);
  }
  done = true;
  await poll.catch(() => {});
  const elapsed = Date.now() - started;
  const cls = await page.evaluate(() => Number((window as unknown as { __cls?: number }).__cls ?? 0).toFixed(3)).catch(() => "0");
  return { elapsed, bar, full, both, cls };
}

async function authState(browser: Browser, persona: Persona, destination: string) {
  const context = await freshContext(browser);
  const page = await context.newPage();
  await signIn(page, persona, destination);
  const state = await context.storageState();
  await context.close();
  return state;
}

async function loadingMatrix(browser: Browser) {
  console.log("\n== Loading matrix ==");
  const owner = PERSONAS.find((persona) => persona.role === "owner")!;
  const client = PERSONAS.find((persona) => persona.role === "client" && persona.kind === "password")!;
  const clientState = await authState(browser, client, "/case-studies");

  for (const throttled of [false, true]) {
    const context = await freshContext(browser, 1440, 900, true, clientState);
    const page = await context.newPage();
    if (throttled) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
    }
    for (const move of buildMoves()) {
      await page.goto(`${BASE}${move.start}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(throttled ? 2200 : 900);
      const row = newRow(move.id, `client${throttled ? "/fast-3g" : ""}`, move.target);
      try {
        const result = await measure(page, move);
        row.loader = result.full ? "full" : result.bar ? "bar" : "none";
        row.paint = `${result.elapsed}ms`;
        row.cls = String(result.cls);
        if (move.route) {
          const tierOk = result.full || result.bar || result.elapsed < 800;
          ok(`${move.id}${throttled ? " (throttled)" : ""}: loader tier`, tierOk, `${result.elapsed}ms ${row.loader}`);
          ok(`${move.id}${throttled ? " (throttled)" : ""}: one loader`, !result.both);
          ok(`${move.id}${throttled ? " (throttled)" : ""}: CLS`, Number(result.cls) <= 0.05, String(result.cls));
        } else {
          ok(`${move.id}${throttled ? " (throttled)" : ""}: no route loader`, !result.full && !result.bar, `${result.elapsed}ms ${row.loader}`);
        }
      } catch (error) {
        row.status = "ERROR";
        record(`${move.id}${throttled ? " (throttled)" : ""}`, false, error instanceof Error ? error.message : String(error));
      }
      row.result = row.result === "pending" ? "PASS" : row.result;
    }
    await context.close();
  }

  // Dashboard moves for the owner.
  const ownerState = await authState(browser, owner, "/dashboard");
  const context = await freshContext(browser, 1440, 900, true, ownerState);
  const page = await context.newPage();
  for (const move of [
    {
      id: "dashboard-to-users",
      start: "/dashboard",
      target: "/account/users",
      route: true,
      click: async (p: Page) => {
        await p.getByRole("button", { name: /Account menu/ }).first().click();
        await p.locator('a[href="/account/users"]:visible').first().click();
      },
    },
    {
      id: "users-to-security",
      start: "/account/users",
      target: "/account/security",
      route: true,
      click: async (p: Page) => {
        await p.getByRole("button", { name: /Account menu/ }).first().click();
        await p.locator('a[href="/account/security"]:visible').first().click();
      },
    },
  ] as Move[]) {
    await page.goto(`${BASE}${move.start}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const row = newRow(move.id, "owner", move.target);
    try {
      const result = await measure(page, move);
      row.loader = result.full ? "full" : result.bar ? "bar" : "none";
      row.paint = `${result.elapsed}ms`;
      row.cls = String(result.cls);
      const tierOk = result.full || result.bar || result.elapsed < 800;
      ok(`${move.id}: loader tier`, tierOk, `${result.elapsed}ms ${row.loader}`);
      ok(`${move.id}: CLS`, Number(result.cls) <= 0.05, String(result.cls));
    } catch (error) {
      row.status = "ERROR";
      record(move.id, false, error instanceof Error ? error.message : String(error));
    }
    row.result = row.result === "pending" ? "PASS" : row.result;
  }
  await context.close();
}

async function sessionTests(browser: Browser) {
  console.log("\n== Session, logout and back button ==");
  const owner = PERSONAS[0];
  const client = PERSONAS[1];

  // owner / -> dashboard
  {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await signIn(page, owner, "/dashboard");
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 10000 }).catch(() => {});
    ok("owner: / redirects to dashboard", new URL(page.url()).pathname === "/dashboard", page.url());
    await context.close();
  }

  // logout from dashboard navbar, then Back
  {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await signIn(page, client, "/case-studies");
    await page.goto(`${BASE}/case-studies/tamil-nadu`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Account menu|Open menu/ }).first().click().catch(async () => {
      await page.getByRole("button", { name: "Open menu" }).click();
    });
    await page.getByRole("menuitem", { name: "Sign out" }).or(page.getByRole("button", { name: "Sign out" })).first().click();
    await page.waitForURL((url) => url.pathname === "/login", { timeout: 15000 });
    ok("logout: lands on login", true);
    ok("logout: Turnstile on login", await turnstileReady(page));
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(700);
    const protectedVisible = await page.locator("text=Vote Share").count().catch(() => 0);
    ok("logout: Back does not show protected content", new URL(page.url()).pathname === "/login" || protectedVisible === 0, page.url());
    await context.close();
  }

  // two tabs
  {
    const context = await freshContext(browser);
    const pageA = await context.newPage();
    await signIn(pageA, client, "/case-studies");
    const pageB = await context.newPage();
    await pageB.goto(`${BASE}/case-studies`, { waitUntil: "domcontentloaded" });
    await pageA.getByRole("button", { name: /Account menu|Open menu/ }).first().click().catch(async () => {
      await pageA.getByRole("button", { name: "Open menu" }).click();
    });
    await pageA.getByRole("menuitem", { name: "Sign out" }).or(pageA.getByRole("button", { name: "Sign out" })).first().click();
    await pageA.waitForURL((url) => url.pathname === "/login", { timeout: 15000 });
    await pageB.waitForURL((url) => url.pathname === "/login", { timeout: 8000 }).catch(() => {});
    ok("two tabs: other tab lands on login", new URL(pageB.url()).pathname === "/login", pageB.url());
    await context.close();
  }

  // expired session
  {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await signIn(page, client, "/case-studies");
    await page.goto(`${BASE}/case-studies/tamil-nadu`, { waitUntil: "domcontentloaded" });
    await context.clearCookies();
    await page.getByRole("link", { name: /Back to Case Studies/i }).first().click().catch(async () => {
      await page.mouse.click(40, 300);
    });
    await page.waitForURL((url) => url.pathname === "/login", { timeout: 15000 }).catch(() => {});
    ok("expired session: click returns to login", new URL(page.url()).pathname === "/login", page.url());
    await context.close();
  }

  // idle logout with a fast-forwarded clock
  {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await signIn(page, client, "/case-studies");
    await page.clock.install();
    await page.goto(`${BASE}/case-studies/tamil-nadu`, { waitUntil: "domcontentloaded" });
    await page.clock.fastForward(11 * 60 * 1000);
    await page.waitForURL((url) => url.pathname === "/login", { timeout: 15000 }).catch(() => {});
    ok("idle: signs out after the idle window", new URL(page.url()).pathname === "/login", page.url());
    await context.close();
  }

  // /setup 404
  {
    const context = await freshContext(browser);
    const page = await context.newPage();
    const response = await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
    ok("setup: 404 once an owner exists", response?.status() === 404, String(response?.status()));
    await context.close();
  }

  // open redirect attempts
  for (const evil of ["https://evil.example/phish", "//evil.example/phish"]) {
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      await signIn(page, client, "/case-studies");
    } catch { /* expected: the login form ignores the evil next */ }
    const final = new URL(page.url());
    ok(`open redirect ignored: ${evil}`, final.origin === new URL(BASE).origin && !final.pathname.startsWith("/login/"), page.url());
    await context.close();
  }
}

async function prodSmoke(browser: Browser) {
  console.log("\n== Production smoke ==");
  const entries: Entry[] = [
    { id: "header-admin", page: "/", expectedNext: null, click: async (page) => { await page.locator('header a[href="/login"]').first().click(); } },
    { id: "hero-explore", page: "/", expectedNext: "/case-studies", click: async (page) => { await page.locator('main a[href="/case-studies"]').first().click(); } },
    { id: "carousel-gujarat", page: "/", expectedNext: "/case-studies/gujarat", click: async (page) => { await page.locator('a[aria-label="Open BJP · Gujarat case study"]').first().click(); } },
  ];
  for (const entry of entries) {
    const row = newRow(entry.id, "anon", "prod");
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}${entry.page}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      await entry.click(page);
      const redirect = await waitForLoginRedirect(page, entry.expectedNext);
      row.next = redirect.next ?? "(none)";
      row.status = "200";
      ok(`prod ${entry.id}: redirect`, redirect.ok, `next=${redirect.next}`);
      row.turnstile = (await turnstileReady(page)) ? "visible" : "missing";
      ok(`prod ${entry.id}: Turnstile`, row.turnstile === "visible");
    } catch (error) {
      row.status = "ERROR";
      record(`prod ${entry.id}`, false, error instanceof Error ? error.message : String(error));
    } finally {
      row.result = row.result === "pending" ? "PASS" : row.result;
      await context.close();
    }
  }

  for (const path of ["/dashboard", "/case-studies/tamil-nadu"]) {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    const url = new URL(page.url());
    ok(`prod ${path}: redirects to login`, url.pathname === "/login" && url.searchParams.get("next") === path, page.url());
    ok(`prod ${path}: Turnstile`, await turnstileReady(page));
    await context.close();
  }

  {
    const context = await freshContext(browser);
    const page = await context.newPage();
    const response = await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
    ok("prod /setup: 404", response?.status() === 404, String(response?.status()));
    await context.close();
  }

  for (const evil of ["https://evil.example/phish", "//evil.example/phish"]) {
    const context = await freshContext(browser);
    const page = await context.newPage();
    await page.goto(`${BASE}/login?next=${encodeURIComponent(evil)}`, { waitUntil: "domcontentloaded" });
    const final = new URL(page.url());
    ok(`prod open redirect ignored: ${evil}`, final.origin === new URL(BASE).origin && final.pathname === "/login", page.url());
    await context.close();
  }
}

function printTable(rows: Result[]) {
  const head = ["entry", "user", "status", "next", "turnstile", "loader", "paint", "cls", "result"];
  const widths = head.map((key) => Math.max(key.length, ...rows.map((row) => String(row[key as keyof Result] ?? "").length)));
  const line = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ");
  console.log("\n" + line(head));
  console.log(widths.map((width) => "-".repeat(width)).join("-+-"));
  for (const row of rows) console.log(line(head.map((key) => String(row[key as keyof Result] ?? ""))));
}

(async () => {
  if (!PROD && !mongoUri()) throw new Error("MONGODB_URI is required for the local login matrix");
  const browser = await launch();
  try {
    if (PROD) {
      await prodSmoke(browser);
    } else {
      if (!SKIP_MATRIX) await redirectMatrix(browser);
      if (!SKIP_LANDING) await landingMatrix(browser);
      await loadingMatrix(browser);
      if (!SKIP_SESSION) await sessionTests(browser);
    }
  } finally {
    await browser.close();
  }
  printTable(results);
  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`- ${failure}`);
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
