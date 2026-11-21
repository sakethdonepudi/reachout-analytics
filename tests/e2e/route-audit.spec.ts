/**
 * Route and interaction audit for the public home, case-study tabs and owner shell.
 *
 * Local run:
 *   npx tsx tests/e2e/route-audit.spec.ts
 *
 * Uses the seeded workspace cookies in .context. No credentials are printed.
 */
import { readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { CASES } from "../../lib/cases";

const BASE = "http://localhost:3101";
const owner = readFileSync(".context/owner-cookie.txt", "utf8").trim().split("=").slice(1).join("=");
const client = readFileSync(".context/client-cookie.txt", "utf8").trim().split("=").slice(1).join("=");
const results: { page: string; element: string; role: string; expected: string; actual: string; result: "PASS" | "FAIL" }[] = [];
let pass = 0;
let fail = 0;

function record(page: string, element: string, role: string, expected: string, actual: string, ok: boolean) {
  if (ok) pass += 1; else fail += 1;
  results.push({ page, element, role, expected, actual, result: ok ? "PASS" : "FAIL" });
  if (!ok) console.log(`FAIL ${page} · ${element} (${role}) :: expected ${expected} · got ${actual}`);
}

async function launch(): Promise<Browser> {
  return chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
}

async function contextWith(browser: Browser, cookie: string | null, width: number): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, hasTouch: width < 900 });
  if (cookie) await context.addCookies([{ name: "ro_session", value: cookie, domain: "localhost", path: "/" }]);
  return context;
}

function wireErrors(page: Page, bag: string[]) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/401 \(Unauthorized\)|Failed to fetch RSC payload|ERR_SSL_PROTOCOL_ERROR/.test(text)) return;
    bag.push(`console: ${text.slice(0, 120)}`);
  });
  page.on("response", (response) => { if (response.status() === 404) bag.push(`404 ${new URL(response.url()).pathname}`); });
}

async function tabTexts(page: Page): Promise<string[]> {
  return page.locator('[aria-label="Case study views"] [role=tab]').allInnerTexts();
}

async function selectedTab(page: Page): Promise<string> {
  return page.locator('[aria-label="Case study views"] [role=tab][aria-selected=true]').innerText();
}

async function clickTab(page: Page, name: RegExp) {
  await page.getByRole("tab", { name }).first().click();
  await page.waitForTimeout(1300);
}

(async () => {
  const browser = await launch();

  // Signed out: public home, entries, gates.
  {
    const context = await contextWith(browser, null, 1440);
    const page = await context.newPage();
    const errors: string[] = [];
    wireErrors(page, errors);
    const response = await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);
    record("/", "Page", "signed out", "200 and Login", `${response?.status()} / ${new URL(page.url()).pathname}`, response?.status() === 200 && await page.getByRole("link", { name: "Login" }).first().isVisible());
    const body = await page.locator("body").innerText();
    record("/", "Admin Login", "signed out", "absent", /Admin Login/i.test(body) ? "present" : "absent", !/Admin Login/i.test(body));

    await page.getByRole("button", { name: /Case Studies/ }).click();
    await page.waitForTimeout(300);
    const caseLinks = page.locator("header [role=menu] a");
    const count = await caseLinks.count();
    const filters = await caseLinks.locator("img").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).filter));
    record("/", "Case Studies dropdown", "signed out", "7 state entries, colour logos", `${count} entries`, count >= 7 && filters.every((value) => value === "none"));
    await page.keyboard.press("Escape");

    for (const item of CASES) {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      await page.locator(`.case-disc[href="/case-studies/${item.slug}"]`).first().click();
      await page.waitForTimeout(700);
      const url = new URL(page.url());
      record("/", `Disc ${item.slug}`, "signed out", `/login?next=/case-studies/${item.slug}`, `${url.pathname}?${url.searchParams.get("next")}`, url.pathname === "/login" && url.searchParams.get("next") === `/case-studies/${item.slug}`);
    }

    for (const item of CASES) {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      await page.locator("#work a").filter({ hasText: `${item.party} · ${item.stateName}` }).first().click();
      await page.waitForTimeout(700);
      const url = new URL(page.url());
      record("/", `Our work ${item.slug}`, "signed out", `/login?next=/case-studies/${item.slug}`, `${url.pathname}?${url.searchParams.get("next")}`, url.pathname === "/login" && url.searchParams.get("next") === `/case-studies/${item.slug}`);
    }

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    await page.evaluate(() => { const tour = document.getElementById("tour"); if (tour) window.scrollTo(0, tour.getBoundingClientRect().top + scrollY + tour.offsetHeight - innerHeight + 80); });
    await page.waitForTimeout(2000);
    const pin = page.locator("button").filter({ hasText: "AIADMK · Tamil Nadu" }).first();
    if (await pin.count()) {
      await pin.click({ force: true });
      await page.waitForTimeout(900);
      const url = new URL(page.url());
      record("/", "Map Tamil Nadu", "signed out", "/login?next=/case-studies/tamil-nadu", `${url.pathname}?${url.searchParams.get("next")}`, url.pathname === "/login" && url.searchParams.get("next") === "/case-studies/tamil-nadu");
    } else record("/", "Map Tamil Nadu", "signed out", "pin exists", "missing", false);

    for (const route of ["/case-studies", "/dashboard", "/account/security"]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      const url = new URL(page.url());
      record(route, "Route guard", "signed out", `/login?next=${route}`, `${url.pathname}?${url.searchParams.get("next")}`, url.pathname === "/login" && url.searchParams.get("next") === route);
    }
    for (const api of ["/api/data/summary", "/api/ads/summaries"]) {
      const result = await context.request.get(`${BASE}${api}`);
      record(api, "API guard", "signed out", "401", String(result.status()), result.status() === 401);
    }
    record("/", "Console and 404s", "signed out", "none", errors.length ? errors.join("; ") : "none", errors.length === 0);
    await context.close();
  }

  // Client: tabs, fallback, year, expand and reasons.
  {
    const context = await contextWith(browser, client, 1440);
    const page = await context.newPage();
    const errors: string[] = [];
    wireErrors(page, errors);
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    record("/", "Client navbar", "client", "Home, Case Studies, user chip", await page.locator("header nav a, header nav button").allInnerTexts().then((items) => items.filter(Boolean).join(", ")), await page.getByRole("button", { name: /Account menu/ }).isVisible());

    for (const item of CASES) {
      await page.goto(`${BASE}/case-studies/${item.slug}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      const tabs = await tabTexts(page);
      const expected = item.tabs ?? ["opinion", "social"];
      const labels = expected.map((id) => id === "exit" ? "Exit Poll" : id === "opinion" ? "Opinion Poll" : "Social Media");
      record(`/case-studies/${item.slug}`, "Tabs", "client", labels.join(", "), tabs.join(", "), JSON.stringify(tabs) === JSON.stringify(labels));
      for (const label of labels) {
        const wasActive = (await selectedTab(page)) === label;
        if (wasActive) {
          const id = label === "Exit Poll" ? "exit" : label === "Opinion Poll" ? "opinion" : "social";
          record(`/case-studies/${item.slug}`, `Tab ${label}`, "client", `default ${id} panel visible`, String(await page.locator(`#case-panel-${id}`).isVisible()), await page.locator(`#case-panel-${id}`).isVisible());
          continue;
        }
        await clickTab(page, new RegExp(`^${label}$`));
        const url = new URL(page.url());
        const id = label === "Exit Poll" ? "exit" : label === "Opinion Poll" ? "opinion" : "social";
        const panel = page.locator(`#case-panel-${id}`);
        record(`/case-studies/${item.slug}`, `Tab ${label}`, "client", `view=${id} and panel visible`, `${url.searchParams.get("view")} / ${await panel.isVisible()}`, url.searchParams.get("view") === id && await panel.isVisible());
      }
    }

    await page.goto(`${BASE}/case-studies/tamil-nadu?view=polls`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    record("/case-studies/tamil-nadu", "Legacy view=polls", "client", "first poll tab (Exit Poll)", await selectedTab(page), (await selectedTab(page)) === "Exit Poll");
    await page.goto(`${BASE}/case-studies/tamil-nadu?view=nope`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    record("/case-studies/tamil-nadu", "Invalid view fallback", "client", "Exit Poll", await selectedTab(page), (await selectedTab(page)) === "Exit Poll");

    await page.goto(`${BASE}/case-studies/tamil-nadu?view=opinion`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: /Expand/ }).first().click();
    await page.waitForTimeout(1600);
    record("/case-studies/tamil-nadu", "Expand", "client", "expand=1 and analysis sections", new URL(page.url()).search, new URL(page.url()).searchParams.get("expand") === "1" && await page.getByText("Vote share by segment").isVisible());
    record("/case-studies/tamil-nadu", "Segments", "client", "gender bars and table", `${await page.getByText("Male", { exact: true }).count()} Male labels`, await page.getByText("Male", { exact: true }).count() > 0);
    await page.getByRole("tab", { name: /^Region/ }).click();
    await page.waitForTimeout(500);
    record("/case-studies/tamil-nadu", "Segment Region", "client", "region panel", String(await page.getByRole("tab", { name: /^Region/ }).getAttribute("aria-selected")), (await page.getByRole("tab", { name: /^Region/ }).getAttribute("aria-selected")) === "true");
    const reason = page.locator('button[aria-controls="reason-tvk-surge"]');
    if (await reason.count()) {
      await reason.click();
      await page.waitForTimeout(500);
      record("/case-studies/tamil-nadu", "Reason open", "client", "expanded explanation", `${await page.getByText("A sustained digital push").isVisible()}`, await page.getByText("A sustained digital push").isVisible());
      await reason.click();
      await page.waitForTimeout(400);
      record("/case-studies/tamil-nadu", "Reason close", "client", "aria-expanded false", String(await reason.getAttribute("aria-expanded")), (await reason.getAttribute("aria-expanded")) === "false");
    } else record("/case-studies/tamil-nadu", "Reason", "client", "reason button", "missing", false);
    await page.screenshot({ path: ".context/case-tabs/route-audit-expanded.png" });
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(700);
    record("/case-studies/tamil-nadu", "Close analysis", "client", "expand removed", new URL(page.url()).search, !new URL(page.url()).searchParams.has("expand"));
    record("/case-studies/tamil-nadu", "Console and 404s", "client", "none", errors.length ? errors.join("; ") : "none", errors.length === 0);
    await context.close();
  }

  // Owner: sidebar, upload card and case-study shell.
  {
    const context = await contextWith(browser, owner, 1440);
    const page = await context.newPage();
    const errors: string[] = [];
    wireErrors(page, errors);
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    record("/", "Owner home", "owner", "/dashboard", new URL(page.url()).pathname, new URL(page.url()).pathname === "/dashboard");
    record("/dashboard", "Sidebar", "owner", "visible", `${await page.locator('[aria-label="Owner navigation"]').isVisible()}`, await page.locator('[aria-label="Owner navigation"]').isVisible());
    for (const label of ["Dashboard", "Case Studies", "Users", "Security"]) {
      record("/dashboard", `Sidebar ${label}`, "owner", "link exists", `${await page.getByRole("link", { name: label }).count()}`, await page.getByRole("link", { name: label }).count() > 0);
    }
    record("/dashboard", "Dataset picker", "owner", "Vote share, Segments, Reasons", await page.getByRole("group", { name: "Dataset" }).first().innerText().then((text) => text.replace(/\n+/g, ", ")), await page.getByRole("button", { name: "Segments", exact: true }).first().isVisible() && await page.getByRole("button", { name: "Reasons", exact: true }).first().isVisible());
    await page.getByRole("button", { name: "Segments", exact: true }).first().click();
    record("/dashboard", "Segments picker", "owner", "pressed", String(await page.getByRole("button", { name: "Segments", exact: true }).first().getAttribute("aria-pressed")), (await page.getByRole("button", { name: "Segments", exact: true }).getAttribute("aria-pressed")) === "true");
    await page.getByRole("link", { name: "Case Studies" }).click();
    await page.waitForTimeout(900);
    record("/case-studies", "Owner shell", "owner", "sidebar visible", `${new URL(page.url()).pathname}`, new URL(page.url()).pathname === "/case-studies" && await page.locator('[aria-label="Owner navigation"]').isVisible());
    await page.goto(`${BASE}/case-studies/tamil-nadu`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    record("/case-studies/tamil-nadu", "Owner tabs", "owner", "Exit Poll, Opinion Poll, Social Media", (await tabTexts(page)).join(", "), JSON.stringify(await tabTexts(page)) === JSON.stringify(["Exit Poll", "Opinion Poll", "Social Media"]));
    record("/case-studies/tamil-nadu", "Console and 404s", "owner", "none", errors.length ? errors.join("; ") : "none", errors.length === 0);
    await context.close();
  }

  await browser.close();

  console.log("\n| Page | Element | Role | Expected | Actual | Result |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const row of results) console.log(`| ${row.page} | ${row.element} | ${row.role} | ${row.expected} | ${row.actual.replace(/\|/g, "/")} | ${row.result} |`);
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
