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
import { CASES, isLiveCase } from "../../lib/cases";

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

    for (const item of CASES.filter((entry) => isLiveCase(entry.slug))) {
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
    for (const api of ["/api/data/summary", "/api/survey/download?state=tamil-nadu"]) {
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

    await page.goto(`${BASE}/case-studies`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const caseCards = await page.locator('main a[href^="/case-studies/"]').allInnerTexts();
    const caseListBody = await page.locator("main").innerText();
    record("/case-studies", "Case order and count", "client", "Tamil Nadu then Andhra Pradesh, 2 live · 5 coming soon", caseCards.slice(0, 2).map((text) => text.replace(/\n+/g, " ").slice(0, 44)).join(" / "), /Tamil Nadu/.test(caseCards[0] ?? "") && /Andhra Pradesh/.test(caseCards[1] ?? "") && /2 live · 5 coming soon/i.test(caseListBody));

    for (const item of CASES) {
      if (isLiveCase(item.slug)) continue;
      await page.goto(`${BASE}/case-studies/${item.slug}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      const body = await page.locator("body").innerText();
      record(`/case-studies/${item.slug}`, "Coming soon", "client", "title, project in progress and back button", `${item.party} · ${item.stateName}`, body.includes(`${item.party} · ${item.stateName}`) && /project in progress/i.test(body) && body.includes("This case study is being prepared. Please check back soon.") && (await page.getByRole("link", { name: /Back to case studies/i }).count()) >= 1);
      record(`/case-studies/${item.slug}`, "No dashboard tabs", "client", "no case study tabs", String(await tabTexts(page).then((tabs) => tabs.length)), (await tabTexts(page)).length === 0);
    }

    await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=op`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2600);
    const apH1 = await page.locator("h1").allTextContents();
    record("/case-studies/andhra-pradesh-2024", "One h1", "client", "exactly one h1", apH1.join(" | "), apH1.length === 1);
    const apBody = await page.locator("body").innerText();
    const apBodyFlat = apBody.replace(/\s+/g, " ");
    const apCards = ["Opinion poll", "Exit poll", "Post-poll", "Social Media"].map((label) => apBody.includes(label));
    record("/case-studies/andhra-pradesh-2024", "Top cards", "client", "Opinion, Exit, Post-poll, Social", apCards.join(", "), apCards.every(Boolean));
    record("/case-studies/andhra-pradesh-2024", "Opinion values", "client", "NDA 55.9, YSRCP 41.4, seats 154–21", apBodyFlat.includes("NDA 55.9%") && apBodyFlat.includes("YSRCP 41.4%") && apBodyFlat.includes("154–21 seats") ? "visible" : "missing", apBodyFlat.includes("NDA 55.9%") && apBodyFlat.includes("YSRCP 41.4%") && apBodyFlat.includes("154–21 seats"));
    record("/case-studies/andhra-pradesh-2024", "Post-poll card", "client", "latest projection 42–133", apBodyFlat.includes("NDA 45.5%") && apBodyFlat.includes("YSRCP 51.9%") && apBodyFlat.includes("42–133 seats") ? "visible" : "missing", apBodyFlat.includes("NDA 45.5%") && apBodyFlat.includes("YSRCP 51.9%") && apBodyFlat.includes("42–133 seats"));
    for (const width of [1024, 1180, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(220);
      const overlap = await page.evaluate(`(() => {
        const r = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return cs.display === "none" ? null : { l: b.left, r: b.right, t: b.top, b: b.bottom, h: b.height }; };
        const boxes = { title: r("[data-social-title]"), subtitle: r("[data-social-subtitle]"), icons: r("[data-social-icons]"), sparkline: r("[data-social-card] svg[aria-label='Monthly reach']") };
        const entries = Object.entries(boxes).filter(([, value]) => value);
        const hits = [];
        for (let i = 0; i < entries.length; i += 1) for (let j = i + 1; j < entries.length; j += 1) {
          const [an, a] = entries[i]; const [bn, b] = entries[j];
          if (a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t) hits.push(an + "/" + bn);
        }
        return { boxes, hits };
      })()`) as { boxes: Record<string, { h: number } | null>; hits: string[] };
      record("/case-studies/andhra-pradesh-2024", `Social card overlap ${width}`, "client", "title, subtitle, icons and sparkline do not intersect", JSON.stringify(overlap.boxes), overlap.hits.length === 0 && (overlap.boxes.title?.h ?? 99) < 32 && (overlap.boxes.subtitle?.h ?? 99) < 28);
      const periodCards = await page.evaluate(`(() => {
        const hit = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
        const cards = Array.from(document.querySelectorAll(".tn-period-card"));
        const heights = cards.map((card) => Math.round(card.getBoundingClientRect().height));
        const overlaps = [];
        for (const card of cards) {
          const ps = card.querySelectorAll("p");
          const title = ps[0] ? ps[0].getBoundingClientRect() : null;
          const numbers = ps[1] ? ps[1].getBoundingClientRect() : null;
          const chip = card.querySelector("div > span") ? card.querySelector("div > span").getBoundingClientRect() : null;
          if (hit(title, chip)) overlaps.push("title/chip");
          if (hit(title, numbers)) overlaps.push("title/numbers");
          if (hit(chip, numbers)) overlaps.push("chip/numbers");
        }
        return { heights, overlaps, overflow: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length };
      })()`) as { heights: number[]; overlaps: string[]; overflow: number };
      record("/case-studies/andhra-pradesh-2024", `Period card heights ${width}`, "client", "84 to 92 pixels and equal in the row", periodCards.heights.join(", "), periodCards.heights.length === 4 && periodCards.heights.every((height) => height >= 84 && height <= 92));
      record("/case-studies/andhra-pradesh-2024", `Period card overlap ${width}`, "client", "title, chip and numbers do not intersect", `${periodCards.overlaps.length} overlaps / ${periodCards.overflow} overflow`, periodCards.overlaps.length === 0 && periodCards.overflow === 0);
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: document.body.scrollWidth - document.body.clientWidth }));
      record("/case-studies/andhra-pradesh-2024", `No page overflow ${width}`, "client", "no horizontal page scroll", JSON.stringify(overflow), overflow.page <= 1);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(250);
    const apOpTabs = await page.locator("[data-profile-tab]").allTextContents();
    record("/case-studies/andhra-pradesh-2024", "Opinion tabs", "client", "Zone, Area, District, Assembly constituency only", apOpTabs.join(", "), JSON.stringify(apOpTabs) === JSON.stringify(["Zone", "Area", "District", "Assembly constituency"]));
    const apPartyCards = ["NDA · expected", "YSRCP · expected", "INC · expected", "Others · expected"];
    record("/case-studies/andhra-pradesh-2024", "Party cards", "client", "4 expected cards", String(apPartyCards.filter((label) => apBody.includes(label)).length), apPartyCards.every((label) => apBody.includes(label)));
    record("/case-studies/andhra-pradesh-2024", "Lead bar removed", "client", "no leads-by card or stacked bar", apBody.includes("leads by") || await page.locator("[data-bar-party]").count() ? "found" : "clean", !apBody.includes("leads by") && (await page.locator("[data-bar-party]").count()) === 0);
    const apGroups = await page.getByRole("group", { name: "Voter profile" }).innerText();
    record("/case-studies/andhra-pradesh-2024", "Profile groups", "client", "Region only on opinion", apGroups.replace(/\n+/g, ", "), /region/i.test(apGroups) && !/vote & feedback/i.test(apGroups));
    record("/case-studies/andhra-pradesh-2024", "Target absent in opinion", "client", "no YSRCP lead row", String(await page.locator('button[aria-label^="Target Campaign"]:visible').count()), (await page.locator('button[aria-label^="Target Campaign"]:visible').count()) === 0);
    await page.getByRole("button", { name: /Post-poll/ }).click();
    await page.waitForTimeout(1000);
    const cardRdUrl = new URL(page.url());
    const cardRdActive = await page.locator("[data-slot-active='true']").allInnerTexts();
    record("/case-studies/andhra-pradesh-2024", "Post-poll card default", "client", "slot=2026-10 with Oct 2026 selected", `${cardRdUrl.searchParams.get("slot")} / ${cardRdActive.join(", ")}`, cardRdUrl.searchParams.get("slot") === "2026-10" && cardRdActive.some((text) => text.includes("Oct 2026")));
    await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=rd&slot=all&profile=govt`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2600);
    await page.locator("section[aria-label^='Voter profile']").scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const apTargets = await page.locator('button[aria-label^="Target Campaign"]:visible').count();
    record("/case-studies/andhra-pradesh-2024", "Target rows", "client", "two Post-poll gap rows flagged", String(apTargets), apTargets === 2);
    const apTarget = page.locator('button[aria-label^="Target Campaign"]:visible').first();
    await apTarget.evaluate((element) => (element as HTMLElement).click());
    await page.waitForTimeout(1800);
    record("/case-studies/andhra-pradesh-2024", "Target view", "client", "view=social and non-geo audience note", `${new URL(page.url()).searchParams.get("view")}/${new URL(page.url()).searchParams.get("match")}`, new URL(page.url()).searchParams.get("view") === "social" && new URL(page.url()).searchParams.get("match") === "target" && (await page.getByText(/reuse for retargeting and look-alike/i).isVisible().catch(() => false)));
    const explorer = page.locator("section[aria-label='Campaign explorer']");
    const explorerTitle = await explorer.locator("h3").first().innerText();
    const explorerRows = await explorer.locator("tbody tr").count();
    const metricPills = await explorer.getByRole("group", { name: "Explorer metric" }).getByRole("button").count();
    record("/case-studies/andhra-pradesh-2024", "Campaign explorer", "client", "accounts table and ranked chart", `${explorerRows} rows / ${metricPills} pills / ${explorerTitle}`, explorerRows > 1 && metricPills === 6 && /Ad accounts by reach/i.test(explorerTitle));
    record("/case-studies/andhra-pradesh-2024", "No Spent pill", "client", "no Spent metric for clients", /Spent/i.test(await page.locator("body").innerText()) ? "found" : "clean", !/Spent/i.test(await page.locator("body").innerText()));
    const firstAccount = explorer.locator("tbody tr").filter({ hasText: "Ad account 1" }).first();
    await firstAccount.click();
    await page.waitForTimeout(300);
    const selectedTitle = await explorer.locator("h3").first().innerText();
    const selectedPills = await explorer.getByRole("group", { name: "Explorer metric" }).getByRole("button").count();
    const tableTitle = await page.locator("section[aria-label^='Campaigns · Ad account 1']").innerText().catch(() => "");
    record("/case-studies/andhra-pradesh-2024", "Explorer account selection", "client", "top campaigns and campaign table follow the account", `${selectedTitle} / ${tableTitle.slice(0, 40)}`, /Top campaigns · Ad account 1/i.test(selectedTitle) && selectedPills === 5 && /Campaigns · Ad account 1/i.test(tableTitle));
    await firstAccount.click();
    await page.waitForTimeout(300);
    record("/case-studies/andhra-pradesh-2024", "Explorer clear selection", "client", "all accounts restored", await explorer.locator("h3").first().innerText(), /Ad accounts by reach/i.test(await explorer.locator("h3").first().innerText()));
    await page.getByRole("button", { name: /Back to survey/ }).click();
    await page.waitForTimeout(900);
    await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=rd`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2600);
    const directRdUrl = new URL(page.url());
    const directRdActive = await page.locator("[data-slot-active='true']").allInnerTexts();
    record("/case-studies/andhra-pradesh-2024", "Post-poll direct default", "client", "?view=rd redirects to slot=2026-10", `${directRdUrl.searchParams.get("slot")} / ${directRdActive.join(", ")}`, directRdUrl.searchParams.get("slot") === "2026-10" && directRdActive.some((text) => text.includes("Oct 2026")));
    await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=rd&slot=all`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    const apSlots = (await page.getByRole("group", { name: "Survey time slot" }).innerText()).replace(/\n+/g, ", ");
    const apRdTabs = await page.locator("[data-profile-tab]").allTextContents();
    record("/case-studies/andhra-pradesh-2024", "Post-poll tabs", "client", "13 HTML tabs only", apRdTabs.join(", "), JSON.stringify(apRdTabs) === JSON.stringify(["Zone", "Area", "District", "Assembly constituency", "2024 vote", "Govt performance", "MLA performance", "Better schemes", "Super Six", "Corruption", "Preferred leader", "Top expectation", "Social category"]));
    record("/case-studies/andhra-pradesh-2024", "No row campaign buttons", "client", "Leading column has no Campaigns link", String(await page.getByRole("button", { name: /^Campaigns/ }).count()), (await page.getByRole("button", { name: /^Campaigns/ }).count()) === 0);
    record("/case-studies/andhra-pradesh-2024", "Post-poll years", "client", "All years, 2024, 2025, 2026", apSlots, apSlots.includes("All years") && apSlots.includes("2024") && apSlots.includes("2025") && apSlots.includes("2026"));
    await page.getByRole("button", { name: /^2026/ }).click();
    await page.waitForTimeout(700);
    const apSubMonths = (await page.getByRole("group", { name: "Survey time slot" }).innerText()).replace(/\n+/g, ", ");
    record("/case-studies/andhra-pradesh-2024", "Post-poll month dropdown", "client", "2026 sub-months shown", apSubMonths, apSubMonths.includes("Jan 2026") && apSubMonths.includes("Oct 2026"));
    await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=social`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const apSocialBody = await page.locator("body").innerText();
    record("/case-studies/andhra-pradesh-2024", "Social overview", "client", "three periods and no money", `${await page.locator("[data-period-card]").count()} cards`, (await page.locator("[data-period-card]").count()) >= 3 && !/₹|\bspend\b|\bINR\b/i.test(apSocialBody));
    const apPeriodOrder = [apSocialBody.indexOf("Opinion poll period"), apSocialBody.indexOf("Exit poll / election period"), apSocialBody.indexOf("After the 2024 result")];
    record("/case-studies/andhra-pradesh-2024", "Social period order", "client", "Opinion, Exit, After the result", apPeriodOrder.join(", "), apPeriodOrder[0] >= 0 && apPeriodOrder[0] < apPeriodOrder[1] && apPeriodOrder[1] < apPeriodOrder[2]);
    const apOverviewResponse = await page.evaluate(async () => (await fetch("/api/survey/social?state=andhra-pradesh-2024")).json());
    const apAccountNames: string[] = (apOverviewResponse.overview?.accounts ?? []).map((item: { name: string }) => item.name);
    const realApNames = ["Districts AIADMK", "Amazon", "Niagara water falls", "Drama DMK", "TN Civic Edge", "SurveyZoom"];
    record("/case-studies/andhra-pradesh-2024", "AP account names", "client", "only Ad account N aliases", `${apAccountNames.length} accounts`, apAccountNames.length > 0 && apAccountNames.every((name) => /^Ad account \d+$/.test(name)) && !realApNames.some((name) => apAccountNames.includes(name)));
    record("/case-studies/andhra-pradesh-2024", "AP account privacy", "client", "no real name, business, id or href", JSON.stringify(apOverviewResponse).includes("business") || JSON.stringify(apOverviewResponse).includes("acct_name") ? "leaked" : "clean", !JSON.stringify(apOverviewResponse).includes("acct_name") && !JSON.stringify(apOverviewResponse).includes("business"));
    const apSpark = await page.evaluate(() => {
      const svg = document.querySelector("svg[aria-label='Monthly campaigns']");
      const line = svg?.querySelector("polyline");
      const points = line?.getAttribute("points")?.trim().split(/\s+/) ?? [];
      return { polygon: Boolean(svg?.querySelector("polygon")), first: points[0] ?? "", last: points[points.length - 1] ?? "" };
    });
    record("/case-studies/andhra-pradesh-2024", "Social sparkline", "client", "clean full-width line and end dot", JSON.stringify(apSpark), !apSpark.polygon && apSpark.first.startsWith("0.0,") && apSpark.last.startsWith("160.0,"));
    record("/case-studies/andhra-pradesh-2024", "AP no long ids", "client", "no 14 to 17 digit number", /\d{14,17}/.test(apSocialBody) ? "found" : "clean", !/\d{14,17}/.test(apSocialBody));
    await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=op`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    await page.locator("section[aria-label='Andhra Pradesh map']").scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    record("/case-studies/andhra-pradesh-2024", "Map credit removed", "client", "no map credit line", String(await page.getByRole("link", { name: /Map: DataMeet/ }).count()), (await page.getByRole("link", { name: /Map: DataMeet/ }).count()) === 0);
    for (const [tab, expected] of [["zone", 2], ["area", 1], ["dist", 3], ["govt", 2]] as const) {
      await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=rd&slot=all&profile=${tab}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1600);
      await page.locator("section[aria-label^='Voter profile']").scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      const count = await page.locator('button[aria-label^="Target Campaign"]:visible').count();
      record("/case-studies/andhra-pradesh-2024", `Post-poll targets ${tab}`, "client", `${expected} gap rows flagged`, String(count), count === expected);
      if (tab === "zone") {
        const ringRows = await page.evaluate(() => [...document.querySelectorAll('button[aria-label^="Target Campaign"]')].filter((element) => (element as HTMLElement).getClientRects().length > 0).map((element) => (element.closest("tr")?.querySelector("th")?.textContent ?? "").trim()));
        record("/case-studies/andhra-pradesh-2024", "Post-poll gap rows", "client", "South Coastal and Rayalaseema only", ringRows.join(", "), ringRows.length === 2 && ringRows.every((row) => /South Coastal|Rayalaseema/.test(row)));
      }
    }
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
    const tnH1 = await page.locator("h1").allTextContents();
    record("/case-studies/tamil-nadu", "One h1", "client", "exactly one h1", tnH1.join(" | "), tnH1.length === 1);
    const partyBody = await page.locator("body").innerText();
    const partyBodyFlat = partyBody.replace(/\s+/g, " ");
    record("/case-studies/tamil-nadu", "Party cards", "client", "5 expected cards", partyCards.filter((label) => partyBody.includes(label)).length + " / 5", partyCards.every((label) => partyBody.includes(label)));
    record("/case-studies/tamil-nadu", "Updated response total", "client", "117,131 responses", partyBody.includes("1,17,131 responses") || partyBody.includes("117,131 responses") ? "visible" : "missing", partyBody.includes("1,17,131 responses") || partyBody.includes("117,131 responses"));
    record("/case-studies/tamil-nadu", "Updated opinion values", "client", "TVK 38.6, DMK+ 21.5, AIADMK+ 31.9", partyBodyFlat.includes("TVK 38.6%") && partyBodyFlat.includes("DMK+ 21.5%") && partyBodyFlat.includes("AIADMK+ 31.9%") ? "visible" : "missing", partyBodyFlat.includes("TVK 38.6%") && partyBodyFlat.includes("DMK+ 21.5%") && partyBodyFlat.includes("AIADMK+ 31.9%"));
    record("/case-studies/tamil-nadu", "Lead bar removed", "client", "no leads-by card or stacked bar", partyBody.includes("leads by") || await page.locator("[data-bar-party]").count() ? "found" : "clean", !partyBody.includes("leads by") && (await page.locator("[data-bar-party]").count()) === 0);
    record("/case-studies/tamil-nadu", "Removed copy", "client", "no title, dates, note or method", [!partyBody.includes("Opinion, Exit & Result Survey Analysis"), !partyBody.includes("28 Mar 2026 to 07 May 2026"), !partyBody.includes("actual vs prediction"), !partyBody.includes("Method & caveats")].join(", "), !partyBody.includes("Opinion, Exit & Result Survey Analysis") && !partyBody.includes("28 Mar 2026 to 07 May 2026") && !partyBody.includes("actual vs prediction") && !partyBody.includes("Method & caveats"));
    const removedPhrases = ["Coverage:", "groups under 30 answers are hidden", "Each cell shows the actual 2021", "Runner-up", "234 of 234 seats", "majority 118", "Projection: TVK", "The projected winner matches", "Projected winner calls compared"];
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(900);
    const fullBody = await page.locator("body").innerText();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const foundPhrases = removedPhrases.filter((phrase) => partyBody.includes(phrase));
    const foundFullPhrases = removedPhrases.filter((phrase) => fullBody.includes(phrase));
    record("/case-studies/tamil-nadu", "Section 1 wording", "client", "0 removed phrases in the DOM", foundFullPhrases.length ? foundFullPhrases.join("; ") : "clean", foundFullPhrases.length === 0);
    const badgeCount = await page.locator("[role='img'][aria-label$='symbol']").count();
    record("/case-studies/tamil-nadu", "Party badges", "client", "all party badges render", String(badgeCount), badgeCount >= 5);
    record("/case-studies/tamil-nadu", "Swing rows", "client", "6 rows", String(await page.locator("section[aria-label^='Zone swing'] tbody tr").count()), await page.locator("section[aria-label^='Zone swing'] tbody tr").count() === 6);
    record("/case-studies/tamil-nadu", "Swing switch removed", "client", "absent", String(await page.getByRole("combobox", { name: "Swing month" }).count()), (await page.getByRole("combobox", { name: "Swing month" }).count()) === 0);
    record("/case-studies/tamil-nadu", "Seat notes removed", "client", "no majority, projection or hit line", [!fullBody.includes("majority 118"), !fullBody.includes("Projection: TVK"), !fullBody.includes("The projected winner matches")].join(", "), !fullBody.includes("majority 118") && !fullBody.includes("Projection: TVK") && !fullBody.includes("The projected winner matches"));
    const slotText = (await page.getByRole("group", { name: "Survey time slot" }).innerText()).replace(/\n+/g, ", ");
    record("/case-studies/tamil-nadu", "Time slots", "client", "All months plus six dated months, no February", slotText, ["Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Mar 2026", "Apr 2026"].every((label) => slotText.includes(label)) && !slotText.includes("Feb 2026"));
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
    await page.locator('[data-profile-tab="age"]').click();
    await page.waitForTimeout(400);
    record("/case-studies/tamil-nadu", "Profile tab", "client", "profile=age", String(new URL(page.url()).searchParams.get("profile")), new URL(page.url()).searchParams.get("profile") === "age");
    record("/case-studies/tamil-nadu", "Survey form tab", "client", "new profile present", String(await page.locator('[data-profile-tab="form"]').count()), (await page.locator('[data-profile-tab="form"]').count()) === 1);
    await page.locator('[data-profile-tab="caste"]').click();
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
      await target.evaluate((element) => (element as HTMLElement).click());
      const savedScroll = await page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem("ro:tn-survey-scroll") ?? "null")?.y ?? null; } catch { return null; } });
      await page.waitForTimeout(1500);
      const targetSocialTop = await page.evaluate(() => Math.round(document.querySelector("section[aria-label='Social media']")?.getBoundingClientRect().top ?? -1));
      record("/case-studies/tamil-nadu", "Target to social", "client", "view=social and match=target", `${new URL(page.url()).searchParams.get("view")}/${new URL(page.url()).searchParams.get("match")}`, new URL(page.url()).searchParams.get("view") === "social" && new URL(page.url()).searchParams.get("match") === "target");
      record("/case-studies/tamil-nadu", "Target opens at the top", "client", "filtered view under the nav", `${targetSocialTop}px`, targetSocialTop >= 80 && targetSocialTop <= 180);
      await page.getByRole("button", { name: /Back to survey/ }).click();
      await page.waitForTimeout(900);
      const afterTarget = await page.evaluate(() => window.scrollY);
      record("/case-studies/tamil-nadu", "Back restores scroll", "client", "exact previous position", `${savedScroll ?? beforeTarget} to ${afterTarget}`, savedScroll != null ? Math.abs(afterTarget - savedScroll) <= 2 : Math.abs(afterTarget - beforeTarget) <= 12);
      await page.getByRole("button", { name: /^Social Media/ }).first().click();
      await page.waitForTimeout(1400);
      const clearedUrl = new URL(page.url());
      const staleTarget = await page.getByText("Target campaign").isVisible().catch(() => false);
      const socialOverview = await page.getByRole("button", { name: /Showing all periods|Clear filter/ }).isVisible().catch(() => false);
      record("/case-studies/tamil-nadu", "Social card clears target filter", "client", "unfiltered social view", `${clearedUrl.searchParams.get("match") ?? "no match"}/${staleTarget ? "target visible" : "target gone"}`, !clearedUrl.searchParams.get("match") && !staleTarget && socialOverview);
      const beforePeriod = surveyRequests;
      await page.locator("section[aria-label='Campaign periods']").getByRole("button", { name: /Opinion poll/ }).click();
      await page.waitForTimeout(500);
      record("/case-studies/tamil-nadu", "Period filter", "client", "client-side, 0 survey requests", `${surveyRequests - beforePeriod} requests`, surveyRequests === beforePeriod && (await page.getByText(/Showing Opinion poll/).first().isVisible().catch(() => false)));
      const periodText = await page.locator("section[aria-label='Campaign periods']").innerText();
      record("/case-studies/tamil-nadu", "Periods have no responses", "client", "campaigns and reach only", /responses/i.test(periodText) ? "responses found" : "clean", !/responses/i.test(periodText));
      const chart = page.locator('svg[aria-label="Monthly reach and engagement"]').first();
      await chart.scrollIntoViewIfNeeded().catch(() => {});
      const chartBox = await chart.boundingBox().catch(() => null);
      const beforeChart = surveyRequests;
      if (chartBox) { await page.mouse.move(chartBox.x + chartBox.width * 0.55, chartBox.y + chartBox.height * 0.5); await page.waitForTimeout(250); }
      const chartTip = await chart.locator("xpath=..").locator('[role="tooltip"]').isVisible().catch(() => false);
      record("/case-studies/tamil-nadu", "Chart hover", "client", "tooltip, 0 survey requests", `${surveyRequests - beforeChart} requests/${chartTip ? "tooltip" : "no tooltip"}`, surveyRequests === beforeChart && chartTip);
      await page.getByRole("button", { name: /^Opinion poll/ }).first().click();
      await page.waitForTimeout(900);
    }
    await page.locator('[data-profile-tab="zone"]').click();
    await page.waitForTimeout(400);
    const campaignsLink = page.getByRole("button", { name: /^Campaigns/ }).first();
    if (await campaignsLink.isVisible().catch(() => false)) {
      await campaignsLink.click();
      await page.waitForTimeout(1500);
      record("/case-studies/tamil-nadu", "Campaigns to social", "client", "view=social and match=campaigns", `${new URL(page.url()).searchParams.get("view")}/${new URL(page.url()).searchParams.get("match")}`, new URL(page.url()).searchParams.get("view") === "social" && new URL(page.url()).searchParams.get("match") === "campaigns");
      await page.getByRole("button", { name: /Back to survey/ }).click();
      await page.waitForTimeout(900);
    }
    await page.goto(`${BASE}/case-studies/tamil-nadu?view=op`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    const socialCard = page.getByRole("button", { name: /^Social Media/ }).first();
    await socialCard.hover();
    await page.waitForTimeout(900);
    const beforeInstant = surveyRequests;
    const instantMs = await page.evaluate(async () => {
      const card = [...document.querySelectorAll("button")].find((element) => /Social Media/.test(element.textContent ?? "") && (element as HTMLElement).offsetParent !== null) as HTMLElement | undefined;
      if (!card) return -1;
      const started = performance.now();
      card.click();
      for (let frame = 0; frame < 60; frame += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (document.body.innerText.includes("Campaign periods")) return performance.now() - started;
      }
      return performance.now() - started;
    });
    record("/case-studies/tamil-nadu", "Social first open", "client", "prefetched, no loading screen", `${Math.round(instantMs)} ms, ${surveyRequests - beforeInstant} requests`, instantMs >= 0 && instantMs < 400 && surveyRequests === beforeInstant);
    await page.goto(`${BASE}/case-studies/tamil-nadu?view=op`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    const mapSection = page.locator("section[aria-label='Tamil Nadu map']");
    await mapSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    record("/case-studies/tamil-nadu", "Single map", "client", "no District or Assembly toggle", String(await page.getByRole("button", { name: "assembly", exact: true }).count()), (await page.getByRole("button", { name: "assembly", exact: true }).count()) === 0);
    const mapCanvas = page.locator("canvas[aria-label*='3D map']");
    await mapCanvas.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
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
    record("/case-studies/tamil-nadu", "Map credit removed", "client", "no map credit line", String(await page.getByRole("link", { name: /Map: DataMeet/ }).count()), (await page.getByRole("link", { name: /Map: DataMeet/ }).count()) === 0);
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

  // Theme toggle, no-flash and the full device matrix.
  {
    const widths = [360, 390, 430, 768, 820, 1024, 1180, 1280, 1440, 1920];
    const deviceCheck = async (page: Page) => page.evaluate(() => {
      const doc = document.documentElement;
      const nav = document.querySelector("header");
      const first = document.querySelector("main .mx-auto > :first-child") as HTMLElement | null;
      const overlap = nav && first ? first.getBoundingClientRect().top < nav.getBoundingClientRect().bottom - 1 : false;
      const badTargets = [...document.querySelectorAll("button,a,[role=button]")].filter((el) => {
        const e = el as HTMLElement;
        const s = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        if (s.visibility === "hidden" || s.display === "none" || r.width === 0 || r.height === 0) return false;
        if (e.closest("[aria-hidden='true']") || e.classList.contains("tn-target") || e.classList.contains("target-ring")) return false;
        return r.width < 44 || r.height < 44;
      }).map((el) => `${el.tagName}.${(el as HTMLElement).className.split(" ").slice(0,2).join(".")}:${Math.round((el as HTMLElement).getBoundingClientRect().width)}x${Math.round((el as HTMLElement).getBoundingClientRect().height)}:${(el.textContent ?? "").trim().slice(0, 16)}`);
      const targets = badTargets.length;
      const small = [...document.querySelectorAll("body *")].filter((el) => {
        const e = el as HTMLElement;
        const s = getComputedStyle(e);
        if (s.visibility === "hidden" || s.display === "none") return false;
        if (e.closest("[aria-hidden='true']") || e.closest(".sr-only") || e.closest("[data-map-credit]") || e.closest("[data-party-badge='true']") || e.classList.contains("tn-target")) return false;
        if (["svg", "path", "circle", "rect", "polyline", "polygon", "stop"].includes(e.tagName.toLowerCase())) return false;
        const hasText = [...e.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? "").trim());
        return hasText && parseFloat(s.fontSize) < 12;
      }).length;
      return { scroll: doc.scrollWidth, client: doc.clientWidth, overlap, targets, small, bad: badTargets.slice(0, 6) };
    });
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addCookies([{ name: "ro_session", value: client, domain: "localhost", path: "/" }]);
      const page = await context.newPage();
      await page.addInitScript((value) => localStorage.setItem("ro-theme", value), theme);
      await page.goto(`${BASE}/case-studies/tamil-nadu?view=op&profile=caste`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(900);
      await page.evaluate(() => window.scrollTo(0, 0));
      for (const width of widths) {
        await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
        await page.waitForTimeout(180);
        const result = await deviceCheck(page);
        record("/case-studies/tamil-nadu", `Device ${theme} ${width} survey`, "client", "no h-scroll, nav clear, tap >=44, text >=12", `scroll ${result.scroll}/${result.client}, overlap ${result.overlap}, targets ${result.targets}, small ${result.small}${result.targets ? `, ${result.bad.join(" | ")}` : ""}`, result.scroll <= result.client + 1 && !result.overlap && result.targets === 0 && result.small === 0);
      }
      await page.goto(`${BASE}/case-studies/tamil-nadu?view=social`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      for (const width of widths) {
        await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
        await page.waitForTimeout(180);
        const result = await deviceCheck(page);
        record("/case-studies/tamil-nadu", `Device ${theme} ${width} social`, "client", "no h-scroll, nav clear, tap >=44, text >=12", `scroll ${result.scroll}/${result.client}, overlap ${result.overlap}, targets ${result.targets}, small ${result.small}${result.targets ? `, ${result.bad.join(" | ")}` : ""}`, result.scroll <= result.client + 1 && !result.overlap && result.targets === 0 && result.small === 0);
      }
      await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=op`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
      for (const width of widths) {
        await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
        await page.waitForTimeout(180);
        const result = await deviceCheck(page);
        record("/case-studies/andhra-pradesh-2024", `Device ${theme} ${width} survey`, "client", "no h-scroll, nav clear, tap >=44, text >=12", `scroll ${result.scroll}/${result.client}, overlap ${result.overlap}, targets ${result.targets}, small ${result.small}${result.targets ? `, ${result.bad.join(" | ")}` : ""}`, result.scroll <= result.client + 1 && !result.overlap && result.targets === 0 && result.small === 0);
      }
      await page.goto(`${BASE}/case-studies/andhra-pradesh-2024?view=social`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1600);
      for (const width of widths) {
        await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
        await page.waitForTimeout(180);
        const result = await deviceCheck(page);
        record("/case-studies/andhra-pradesh-2024", `Device ${theme} ${width} social`, "client", "no h-scroll, nav clear, tap >=44, text >=12", `scroll ${result.scroll}/${result.client}, overlap ${result.overlap}, targets ${result.targets}, small ${result.small}${result.targets ? `, ${result.bad.join(" | ")}` : ""}`, result.scroll <= result.client + 1 && !result.overlap && result.targets === 0 && result.small === 0);
      }
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addCookies([{ name: "ro_session", value: client, domain: "localhost", path: "/" }]);
      const page = await context.newPage();
      await page.addInitScript(() => { try { if (!localStorage.getItem("ro-theme")) localStorage.setItem("ro-theme", "light"); } catch { /* storage can be blocked */ } });
      let surveyCalls = 0;
      page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/survey/")) surveyCalls += 1; });
      await page.goto(`${BASE}/case-studies/tamil-nadu?view=op`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1800);
      const beforeToggle = surveyCalls;
      await page.locator("[data-theme-toggle]:visible").first().click();
      await page.waitForTimeout(250);
      const darkNow = await page.evaluate(() => document.documentElement.dataset.theme);
      record("/case-studies/tamil-nadu", "Theme toggle", "client", "dark, 0 survey requests", `${darkNow}/${surveyCalls - beforeToggle} requests`, darkNow === "dark" && surveyCalls === beforeToggle);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      record("/case-studies/tamil-nadu", "Theme remembered", "client", "dark after reload", String(await page.evaluate(() => document.documentElement.dataset.theme)), (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      await context.addCookies([{ name: "ro_session", value: client, domain: "localhost", path: "/" }]);
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem("ro-theme", "light"));
      await page.goto(`${BASE}/case-studies/tamil-nadu?view=op`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.waitForTimeout(250);
      await page.locator("[data-theme-toggle]:visible").last().click();
      await page.waitForTimeout(250);
      record("/case-studies/tamil-nadu", "Themetoggle in the hamburger", "client", "dark on phone", String(await page.evaluate(() => document.documentElement.dataset.theme)), (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addCookies([{ name: "ro_session", value: client, domain: "localhost", path: "/" }]);
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem("ro-theme", "dark"));
      await page.goto(`${BASE}/case-studies/tamil-nadu?view=op`, { waitUntil: "domcontentloaded" });
      const first = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, body: getComputedStyle(document.body).backgroundColor }));
      record("/case-studies/tamil-nadu", "No theme flash", "client", "dark at first paint", `${first.theme}/${first.body}`, first.theme === "dark" && first.body === "rgb(18, 18, 17)");
      await context.close();
    }
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
    const uploadCards = await page.getByRole("heading", { name: /upload dashboard HTML$/ }).count();
    const dashboardBody = await page.locator("main").innerText();
    record("/dashboard", "Two state upload cards", "owner", "Tamil Nadu and Andhra Pradesh only", `${uploadCards} cards`, uploadCards === 2 && await page.getByRole("heading", { name: "Tamil Nadu: upload dashboard HTML" }).isVisible() && await page.getByRole("heading", { name: "Andhra Pradesh: upload dashboard HTML" }).isVisible());
    record("/dashboard", "No Excel upload", "owner", "no workbook input or copy", /Excel \/ CSV|xlsx|\.xls|Drop a workbook|Download template/i.test(dashboardBody) ? "found" : "clean", !/Excel \/ CSV|xlsx|\.xls|Drop a workbook|Download template/i.test(dashboardBody));
    record("/dashboard", "No Meta upload", "owner", "no separate Ads Manager card", /Drop the HTML report|HTML report|Meta report above/i.test(dashboardBody) ? "found" : "clean", !/Drop the HTML report|HTML report|Meta report above/i.test(dashboardBody));
    record("/dashboard", "Live versions", "owner", "current file, time and owner shown", /current live version/i.test(dashboardBody) ? "shown" : "missing", /current live version/i.test(dashboardBody));
    await page.getByRole("link", { name: "Case Studies" }).click();
    await page.waitForTimeout(900);
    record("/case-studies", "Owner shell", "owner", "sidebar visible", `${new URL(page.url()).pathname}`, new URL(page.url()).pathname === "/case-studies" && await page.locator('[aria-label="Owner navigation"]').isVisible());
    await page.goto(`${BASE}/case-studies/gujarat`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    const ownerComing = await page.locator("body").innerText();
    record("/case-studies/gujarat", "Owner coming soon", "owner", "same holding page for owners", ownerComing.includes("This case study is being prepared. Please check back soon.") ? "coming soon" : "dashboard", ownerComing.includes("This case study is being prepared. Please check back soon.") && !/Voter profile/i.test(ownerComing));
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

  // Client: a sign-out in one tab closes the session in every other tab.
  {
    const context = await contextWith(browser, client, 1440);
    const first = await context.newPage();
    const second = await context.newPage();
    await first.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await second.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await first.waitForTimeout(1200);
    await second.waitForTimeout(1200);
    await first.getByRole("button", { name: /Account menu/ }).click();
    await first.getByRole("menuitem", { name: /Log out|Sign out/ }).click();
    let redirected = false;
    try { await second.waitForURL(/\/login/, { timeout: 7000 }); redirected = true; } catch { /* recorded below */ }
    record("/", "Cross-tab sign-out", "client", "the other tab reaches login", new URL(second.url()).pathname, redirected);
    await context.close();
  }

  await browser.close();

  console.log("\n| Page | Element | Role | Expected | Actual | Result |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const row of results) console.log(`| ${row.page} | ${row.element} | ${row.role} | ${row.expected} | ${row.actual.replace(/\|/g, "/")} | ${row.result} |`);
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
