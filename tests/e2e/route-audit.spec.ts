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
      if (item.slug === "tamil-nadu") continue;
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

    await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=opinion&period=op`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    record("/case-studies/andhra-pradesh-2024", "Survey dashboard", "client", "Andhra Pradesh opinion content", await page.getByText(/Andhra Pradesh · Opinion poll/).isVisible().catch(() => false) ? "visible" : "missing", await page.getByText(/Andhra Pradesh · Opinion poll/).isVisible().catch(() => false));
    await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=opinion&period=rd&profile=zone`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);
    record("/case-studies/andhra-pradesh-2024", "Post-poll default year", "client", "year=2026 content", await page.getByText(/Post-poll .*2026/).first().isVisible().catch(() => false) ? "visible" : "missing", await page.getByText(/Post-poll .*2026/).first().isVisible().catch(() => false));
    await page.getByRole("button", { name: "2024", exact: true }).click();
    await page.waitForTimeout(1200);
    record("/case-studies/andhra-pradesh-2024", "Post-poll year switch", "client", "year=2024", String(new URL(page.url()).searchParams.get("year")), new URL(page.url()).searchParams.get("year") === "2024");
    await page.goto(`${BASE}/case-studies/tamil-nadu?view=op`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    let surveyRequests = 0;
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith("/api/survey/")) surveyRequests += 1;
    });
    const tnCards = await Promise.all([/Opinion poll/, /Exit poll/, /Social Media/].map((name) => page.getByRole("button", { name }).first().isVisible().catch(() => false)));
    record("/case-studies/tamil-nadu", "Period cards", "client", "Opinion, Exit, Social", tnCards.join(", "), tnCards.every(Boolean));
    record("/case-studies/tamil-nadu", "No Result card", "client", "absent", String(await page.getByRole("button", { name: /^Result 2026/ }).count()), (await page.getByRole("button", { name: /^Result 2026/ }).count()) === 0);
    const partyCards = ["TVK · expected", "DMK+ · expected", "AIADMK+ · expected", "NTK · expected", "Others · expected"];
    const partyBody = await page.locator("body").innerText();
    record("/case-studies/tamil-nadu", "Party cards", "client", "5 expected cards", partyCards.filter((label) => partyBody.includes(label)).length + " / 5", partyCards.every((label) => partyBody.includes(label)));
    record("/case-studies/tamil-nadu", "Hero lead", "client", "leads by", partyBody.includes("leads by") ? "visible" : "missing", partyBody.includes("leads by"));
    record("/case-studies/tamil-nadu", "Removed copy", "client", "no title, dates, note or method", [!partyBody.includes("Opinion, Exit & Result Survey Analysis"), !partyBody.includes("28 Mar 2026 to 07 May 2026"), !partyBody.includes("actual vs prediction"), !partyBody.includes("Method & caveats")].join(", "), !partyBody.includes("Opinion, Exit & Result Survey Analysis") && !partyBody.includes("28 Mar 2026 to 07 May 2026") && !partyBody.includes("actual vs prediction") && !partyBody.includes("Method & caveats"));
    const removedPhrases = ["Coverage:", "groups under 30 answers are hidden", "Each cell shows the actual 2021", "Runner-up", "234 of 234 seats", "majority 118", "Projection: TVK", "The projected winner matches", "Projected winner calls compared"];
    const foundPhrases = removedPhrases.filter((phrase) => partyBody.includes(phrase));
    record("/case-studies/tamil-nadu", "Section 1 wording", "client", "0 removed phrases in the DOM", foundPhrases.length ? foundPhrases.join("; ") : "clean", foundPhrases.length === 0);
    const badgeCount = await page.locator("[role='img'][aria-label$='symbol']").count();
    record("/case-studies/tamil-nadu", "Party badges", "client", "all party badges render", String(badgeCount), badgeCount >= 5);
    record("/case-studies/tamil-nadu", "Swing rows", "client", "6 rows", String(await page.locator("section[aria-label^='Zone swing'] tbody tr").count()), await page.locator("section[aria-label^='Zone swing'] tbody tr").count() === 6);
    record("/case-studies/tamil-nadu", "Swing switch removed", "client", "absent", String(await page.getByRole("combobox", { name: "Swing month" }).count()), (await page.getByRole("combobox", { name: "Swing month" }).count()) === 0);
    record("/case-studies/tamil-nadu", "Seat notes removed", "client", "no majority, projection or hit line", [!partyBody.includes("majority 118"), !partyBody.includes("Projection: TVK"), !partyBody.includes("The projected winner matches")].join(", "), !partyBody.includes("majority 118") && !partyBody.includes("Projection: TVK") && !partyBody.includes("The projected winner matches"));
    record("/case-studies/tamil-nadu", "Time slots", "client", "All months, Mar 2026, Apr 2026", (await page.getByRole("group", { name: "Survey time slot" }).innerText()).replace(/\n+/g, ", "), (await page.getByRole("button", { name: /^All months/ }).isVisible()) && (await page.getByRole("button", { name: /^Apr 2026/ }).isVisible()));
    const navCount = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    await page.getByRole("button", { name: /^Apr 2026/ }).click();
    await page.waitForTimeout(500);
    record("/case-studies/tamil-nadu", "Month switch", "client", "slot=2026-04 without page load", String(new URL(page.url()).searchParams.get("slot")), new URL(page.url()).searchParams.get("slot") === "2026-04" && (await page.evaluate(() => performance.getEntriesByType("navigation").length)) === navCount);
    const sub = page.getByRole("button", { name: /1.15 Apr/ }).first();
    if (await sub.isVisible().catch(() => false)) {
      await sub.click();
      await page.waitForTimeout(500);
    }
    record("/case-studies/tamil-nadu", "Sub-period switch", "client", "slot=2026-04a", String(new URL(page.url()).searchParams.get("slot")), new URL(page.url()).searchParams.get("slot") === "2026-04a");
    await page.getByRole("tab", { name: "Age group" }).click();
    await page.waitForTimeout(400);
    record("/case-studies/tamil-nadu", "Profile tab", "client", "profile=age", String(new URL(page.url()).searchParams.get("profile")), new URL(page.url()).searchParams.get("profile") === "age");
    await page.getByRole("tab", { name: "Community" }).click();
    await page.waitForTimeout(400);
    record("/case-studies/tamil-nadu", "Profile heat map", "client", "community table", await page.getByRole("region", { name: /Community table/ }).isVisible().catch(() => false) ? "visible" : "missing", await page.getByRole("region", { name: /Community table/ }).isVisible().catch(() => false));
    const partyChips = page.getByRole("group", { name: "Party columns" });
    await partyChips.getByRole("button", { name: /NTK/ }).click();
    await partyChips.getByRole("button", { name: /Others/ }).click();
    await page.waitForTimeout(450);
    const filteredLeading = await page.getByRole("button", { name: /^Leading \(selected\)/ }).isVisible().catch(() => false);
    const filteredHeaders = await page.locator("section[aria-label^='Voter profile'] thead th").count();
    record("/case-studies/tamil-nadu", "Party column filter", "client", "2 columns out, selected leading", `${filteredHeaders} headers`, filteredLeading && filteredHeaders === 5);
    await partyChips.getByRole("button", { name: /^All/ }).click();
    await page.waitForTimeout(450);
    record("/case-studies/tamil-nadu", "Party column reset", "client", "All restores five parties", String((await page.locator("section[aria-label^='Voter profile'] thead th").count()) - 2), (await page.locator("section[aria-label^='Voter profile'] thead th").count()) === 7);
    const group = page.locator("button", { hasText: /^Vanniyar$/ }).first();
    if (await group.isVisible().catch(() => false)) {
      await group.click();
      await page.waitForTimeout(1500);
      record("/case-studies/tamil-nadu", "Group to social", "client", "view=social and match=group", `${new URL(page.url()).searchParams.get("view")}/${new URL(page.url()).searchParams.get("match")}`, new URL(page.url()).searchParams.get("view") === "social" && new URL(page.url()).searchParams.get("match") === "group");
      record("/case-studies/tamil-nadu", "Group social no money", "client", "no currency", /₹|\bspend\b|\bINR\b/i.test(await page.locator("body").innerText()) ? "money found" : "clean", !/₹|\bspend\b|\bINR\b/i.test(await page.locator("body").innerText()));
      await page.getByRole("button", { name: /Back to survey/ }).click();
      await page.waitForTimeout(900);
    }
    const target = page.getByRole("button", { name: /^Target Campaign/ }).first();
    if (await target.isVisible().catch(() => false)) {
      await target.evaluate((element) => element.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(250);
      const beforeTarget = await page.evaluate(() => window.scrollY);
      await target.click({ force: true });
      await page.waitForTimeout(1500);
      const targetSocialTop = await page.evaluate(() => Math.round(document.querySelector("section[aria-label='Social media']")?.getBoundingClientRect().top ?? -1));
      record("/case-studies/tamil-nadu", "Target to social", "client", "view=social and match=target", `${new URL(page.url()).searchParams.get("view")}/${new URL(page.url()).searchParams.get("match")}`, new URL(page.url()).searchParams.get("view") === "social" && new URL(page.url()).searchParams.get("match") === "target");
      record("/case-studies/tamil-nadu", "Target opens at the top", "client", "filtered view under the nav", `${targetSocialTop}px`, targetSocialTop >= 80 && targetSocialTop <= 180);
      await page.getByRole("button", { name: /Back to survey/ }).click();
      await page.waitForTimeout(900);
      const afterTarget = await page.evaluate(() => window.scrollY);
      record("/case-studies/tamil-nadu", "Back restores scroll", "client", "exact previous position", `${beforeTarget} to ${afterTarget}`, Math.abs(afterTarget - beforeTarget) <= 2);
      await page.getByRole("button", { name: /^Social Media/ }).first().click();
      await page.waitForTimeout(1400);
      const clearedUrl = new URL(page.url());
      const staleTarget = await page.getByText("Target campaign").isVisible().catch(() => false);
      const socialOverview = await page.getByRole("button", { name: /^All periods/ }).isVisible().catch(() => false);
      record("/case-studies/tamil-nadu", "Social card clears target filter", "client", "unfiltered social view", `${clearedUrl.searchParams.get("match") ?? "no match"}/${staleTarget ? "target visible" : "target gone"}`, !clearedUrl.searchParams.get("match") && !staleTarget && socialOverview);
      const beforePeriod = surveyRequests;
      await page.locator("section[aria-label='Campaign periods']").getByRole("button", { name: /Opinion poll/ }).click();
      await page.waitForTimeout(500);
      record("/case-studies/tamil-nadu", "Period filter", "client", "client-side, 0 survey requests", `${surveyRequests - beforePeriod} requests`, surveyRequests === beforePeriod && (await page.getByText(/Showing Opinion poll/).isVisible().catch(() => false)));
      await page.getByRole("button", { name: /^Opinion poll/ }).first().click();
      await page.waitForTimeout(900);
    }
    await page.getByRole("tab", { name: "Zone" }).click();
    await page.waitForTimeout(400);
    const campaignsLink = page.getByRole("button", { name: /^Campaigns/ }).first();
    if (await campaignsLink.isVisible().catch(() => false)) {
      await campaignsLink.click();
      await page.waitForTimeout(1500);
      record("/case-studies/tamil-nadu", "Campaigns to social", "client", "view=social and match=campaigns", `${new URL(page.url()).searchParams.get("view")}/${new URL(page.url()).searchParams.get("match")}`, new URL(page.url()).searchParams.get("view") === "social" && new URL(page.url()).searchParams.get("match") === "campaigns");
      await page.getByRole("button", { name: /Back to survey/ }).click();
      await page.waitForTimeout(900);
    }
    const mapSection = page.locator("section[aria-label='Tamil Nadu map']");
    await mapSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    record("/case-studies/tamil-nadu", "Single map", "client", "no District or Assembly toggle", String(await page.getByRole("button", { name: "assembly", exact: true }).count()), (await page.getByRole("button", { name: "assembly", exact: true }).count()) === 0);
    const mapCanvas = page.locator("canvas[aria-label*='3D map']");
    const box = await mapCanvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.waitForTimeout(450);
      const districtTip = await page.locator('[data-testid="map-tooltip"]').innerText().catch(() => "");
      record("/case-studies/tamil-nadu", "Map district card", "client", "name and party shares only", districtTip.replace(/\n+/g, " / "), districtTip.includes("%") && !/responses|lead |pp/i.test(districtTip));
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.waitForTimeout(1200);
      const backChip = await page.getByRole("button", { name: /Back to state/ }).isVisible().catch(() => false);
      record("/case-studies/tamil-nadu", "Map drills into a district", "client", "ACs and Back to state", backChip ? "drilled" : "missing", backChip);
      await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.48);
      await page.waitForTimeout(500);
      const acTip = await page.locator('[data-testid="map-tooltip"]').innerText().catch(() => "");
      record("/case-studies/tamil-nadu", "Map AC card", "client", "name and shares only", acTip.replace(/\n+/g, " / "), acTip.includes("%") && !/responses|lead |pp/i.test(acTip));
      await page.getByRole("button", { name: /Back to state/ }).click();
      await page.waitForTimeout(1000);
      record("/case-studies/tamil-nadu", "Map back to state", "client", "district view returns", String(await page.getByRole("button", { name: /Back to state/ }).count()), (await page.getByRole("button", { name: /Back to state/ }).count()) === 0);
    }
    await page.goto(`${BASE}/case-studies/tamil-nadu?view=rs`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    record("/case-studies/tamil-nadu", "Old rs link", "client", "redirects to op", String(new URL(page.url()).searchParams.get("view")), new URL(page.url()).searchParams.get("view") === "op");
    await page.getByRole("button", { name: /^Social Media/ }).click();
    await page.waitForTimeout(1600);
    record("/case-studies/tamil-nadu", "Social view", "client", "view=social", String(new URL(page.url()).searchParams.get("view")), new URL(page.url()).searchParams.get("view") === "social");
    record("/case-studies/tamil-nadu", "Social no money", "client", "no currency", /₹|\bspend\b|\bINR\b/i.test(await page.locator("body").innerText()) ? "money found" : "clean", !/₹|\bspend\b|\bINR\b/i.test(await page.locator("body").innerText()));
    const clientSocial = await page.evaluate(async () => (await fetch("/api/survey/social?state=tamil-nadu")).json());
    const clientAccounts = (clientSocial.overview?.accounts ?? []) as Array<Record<string, unknown>>;
    const clientPrivate = clientAccounts.length > 0 && clientAccounts.every((account) => !("id" in account) && !("business" in account) && !("href" in account));
    record("/case-studies/tamil-nadu", "Social account privacy", "client", "names only, no business or id", clientPrivate ? "clean" : "leaked", clientPrivate);
    record("/case-studies/tamil-nadu", "Social payload ids", "client", "no 14-17 digit number", /\d{14,17}/.test(JSON.stringify(clientSocial)) ? "found" : "clean", !/\d{14,17}/.test(JSON.stringify(clientSocial)));
    let unnamed = page.getByRole("button", { name: /^Ad account \d+/ }).first();
    let unnamedVisible = await unnamed.isVisible().catch(() => false);
    for (let pageIndex = 0; pageIndex < 5 && !unnamedVisible; pageIndex += 1) {
      const next = page.getByRole("button", { name: "Next" }).last();
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click();
      await page.waitForTimeout(300);
      unnamed = page.getByRole("button", { name: /^Ad account \d+/ }).first();
      unnamedVisible = await unnamed.isVisible().catch(() => false);
    }
    if (unnamedVisible) {
      await unnamed.click();
      await page.waitForTimeout(1500);
      const rows = await page.locator("section[aria-label*='Campaigns'] tbody tr").count();
      record("/case-studies/tamil-nadu", "Expand unnamed account", "client", "campaigns load", String(rows), rows > 0);
    } else {
      record("/case-studies/tamil-nadu", "Expand unnamed account", "client", "campaigns load", "not found", false);
    }
    const clientFiltered = await page.evaluate(async () => (await fetch("/api/survey/social?state=tamil-nadu&mode=filter&match=group&group=Vanniyar")).json());
    record("/case-studies/tamil-nadu", "Filtered payload ids", "client", "no 14-17 digit number", /\d{14,17}/.test(JSON.stringify(clientFiltered)) ? "found" : "clean", !/\d{14,17}/.test(JSON.stringify(clientFiltered)));
    await page.goBack();
    await page.waitForTimeout(900);
    record("/case-studies/tamil-nadu", "Back to survey", "client", "view=op", String(new URL(page.url()).searchParams.get("view")), new URL(page.url()).searchParams.get("view") === "op");
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
    record("/dashboard", "Survey upload", "owner", "HTML dashboard and state picker", `${await page.getByRole("heading", { name: "HTML survey dashboard" }).count()}`, await page.getByRole("heading", { name: "HTML survey dashboard" }).isVisible().catch(() => false) && await page.getByRole("group", { name: "Survey state" }).isVisible().catch(() => false));
    record("/dashboard", "Survey state", "owner", "Tamil Nadu and Andhra Pradesh", `${await page.getByRole("group", { name: "Survey state" }).innerText().then((text) => text.replace(/\n+/g, ", "))}`, await page.getByRole("button", { name: "Tamil Nadu", exact: true }).isVisible().catch(() => false));
    await page.getByRole("link", { name: "Case Studies" }).click();
    await page.waitForTimeout(900);
    record("/case-studies", "Owner shell", "owner", "sidebar visible", `${new URL(page.url()).pathname}`, new URL(page.url()).pathname === "/case-studies" && await page.locator('[aria-label="Owner navigation"]').isVisible());
    await page.goto(`${BASE}/case-studies/tamil-nadu`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    record("/case-studies/tamil-nadu", "Owner cards", "owner", "Opinion, Exit, Social", (await Promise.all([/Opinion poll/, /Exit poll/, /Social Media/].map((name) => page.getByRole("button", { name }).first().isVisible().catch(() => false)))).join(", "), (await Promise.all([/Opinion poll/, /Exit poll/, /Social Media/].map((name) => page.getByRole("button", { name }).first().isVisible().catch(() => false)))).every(Boolean));
    record("/case-studies/tamil-nadu", "Owner download", "owner", "button visible", String(await page.getByRole("button", { name: /Download data/ }).count()), await page.getByRole("button", { name: /Download data/ }).first().isVisible().catch(() => false));
    const ownerSocial = await page.evaluate(async () => (await fetch("/api/survey/social?state=tamil-nadu")).json());
    const ownerAccounts = (ownerSocial.overview?.accounts ?? []) as Array<Record<string, unknown>>;
    record("/case-studies/tamil-nadu", "Owner social identity", "owner", "id and business visible", ownerAccounts.length > 0 && ownerAccounts.every((account) => "id" in account && "business" in account) ? "visible" : "missing", ownerAccounts.length > 0 && ownerAccounts.every((account) => "id" in account && "business" in account));
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
