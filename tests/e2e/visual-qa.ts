/**
 * Visual and accessibility QA across the main destinations and four widths.
 *
 *   npx tsx --conditions react-server .context/make-session-user.ts owner
 *   npx tsx --conditions react-server .context/make-session-user.ts client
 *   npx tsx tests/e2e/visual-qa.ts
 *
 * Screenshots go to .context/qa/shots and the results to .context/qa/visual-qa.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const BASE = process.env.E2E_BASE_URL || "http://localhost:3101";
const WIDTHS = [
  { name: "1440", width: 1440, height: 900, touch: false },
  { name: "1280", width: 1280, height: 800, touch: false },
  { name: "768", width: 768, height: 1024, touch: true },
  { name: "390", width: 390, height: 844, touch: true },
];

type Role = "anon" | "owner" | "client";
type PageDef = { path: string; role: Role; name: string; caseStudy?: boolean };

const PAGES: PageDef[] = [
  { path: "/", role: "anon", name: "home" },
  { path: "/services", role: "anon", name: "services" },
  { path: "/services/research-content", role: "anon", name: "research" },
  { path: "/about", role: "anon", name: "about" },
  { path: "/login", role: "anon", name: "login" },
  { path: "/does-not-exist", role: "anon", name: "not-found" },
  { path: "/setup", role: "anon", name: "setup-disabled" },
  { path: "/case-studies", role: "client", name: "chooser" },
  { path: "/case-studies/tamil-nadu", role: "client", name: "tamil-nadu", caseStudy: true },
  { path: "/case-studies/telangana", role: "client", name: "telangana", caseStudy: true },
  { path: "/case-studies/gujarat", role: "client", name: "gujarat", caseStudy: true },
  { path: "/no-access", role: "client", name: "no-access" },
  { path: "/dashboard", role: "owner", name: "dashboard" },
  { path: "/dashboard/case-studies", role: "owner", name: "dashboard-cases" },
  { path: "/account/users", role: "owner", name: "users" },
  { path: "/account/security", role: "owner", name: "security" },
  { path: "/account/sessions", role: "owner", name: "sessions" },
  { path: "/account/password", role: "owner", name: "password" },
];

function cookieFor(role: Role): string | null {
  if (role === "anon") return null;
  try {
    const line = readFileSync(`.context/${role}-cookie.txt`, "utf8").trim();
    return line.split("=").slice(1).join("=");
  } catch {
    return null;
  }
}

type Finding = { page: string; width: string; issues: string[]; axe: string[]; shot: string };

async function audit(page: Page, def: PageDef, width: string, shot: string): Promise<Finding> {
  const issues: string[] = [];

  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const horizontal = doc.scrollWidth > doc.clientWidth + 1;

    const clipped: string[] = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,p,li,span"))) {
      const style = getComputedStyle(element);
      if (!element.offsetParent || style.visibility === "hidden" || style.display === "none") continue;
      if (style.textOverflow === "ellipsis") continue;
      if (element.closest(".sr-only, .company-marquee, [aria-hidden='true']")) continue;
      if (style.overflowX === "hidden" || style.overflowX === "clip") {
        if (element.scrollWidth > element.clientWidth + 2 && element.clientWidth > 0) {
          clipped.push(`${element.tagName.toLowerCase()}: ${(element.textContent ?? "").trim().slice(0, 40)}`);
        }
      }
    }

    const small: string[] = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("a,button,[role='button'],input,select,textarea"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
      if (rect.height < 39 || rect.width < 39) {
        const checkbox = element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio");
        if (checkbox && (element.closest("label")?.getBoundingClientRect().height ?? 0) >= 39) continue;
        const label = (element.getAttribute("aria-label") || element.textContent || element.tagName).trim().slice(0, 40);
        small.push(`${Math.round(rect.width)}x${Math.round(rect.height)} ${label}`);
      }
    }

    const fixed = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.position === "fixed" && element.offsetParent !== null && style.visibility !== "hidden" && style.display !== "none";
      })
      .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 40)}`);

    return { horizontal, clipped: clipped.slice(0, 8), small: small.slice(0, 8), smallCount: small.length, fixed: [...new Set(fixed)].slice(0, 10) };
  });

  if (layout.horizontal) issues.push("horizontal scroll");
  if (layout.clipped.length) issues.push(`clipped text: ${layout.clipped.join(" | ")}`);
  if (layout.smallCount) issues.push(`${layout.smallCount} small targets: ${layout.small.join(" | ")}`);
  if (layout.fixed.length) issues.push(`fixed layers: ${layout.fixed.join(", ")}`);

  await page.screenshot({ path: shot, fullPage: false });

  // Map overlays must not render over other sections.
  if (def.path === "/") {
    const outside = await page.evaluate(() => {
      const work = document.getElementById("work");
      if (!work) return true;
      work.scrollIntoView({ block: "start" });
      window.scrollBy(0, -80);
      return true;
    });
    if (outside) {
      await page.waitForTimeout(700);
      const overlap = await page.evaluate(() => {
        const points = [
          [innerWidth / 2, 120],
          [innerWidth / 2, innerHeight / 2],
          [innerWidth / 2, innerHeight - 80],
        ];
        return points.some(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest("#tour [data-ui], #tour canvas")));
      });
      if (overlap) issues.push("map UI overlaps Our work");
    }
  }

  // Keyboard focus should show a ring.
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return { visible: false, style: "none" };
    const style = getComputedStyle(active);
    const visible = (style.outlineStyle !== "none" && style.outlineWidth !== "0px") || style.boxShadow !== "none";
    return { visible, style: `${style.outlineStyle} ${style.outlineWidth} ${style.boxShadow.slice(0, 40)}` };
  });
  if (!focus.visible) issues.push(`no focus ring on first tab stop (${focus.style})`);

  // Trigger every reveal animation before axe measures colours.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 70));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 700));
  }).catch(() => {});

  // The suite measures the settled page, not an element mid-reveal.
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>(".reveal").forEach((element) => {
      element.classList.remove("reveal-hidden");
      element.classList.add("is-visible");
      element.style.transition = "none";
      element.style.opacity = "1";
      element.style.transform = "none";
    });
  }).catch(() => {});

  await page.addScriptTag({ content: axeSource });
  const axe = await page.evaluate(async () => {
    const result = await (window as unknown as { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ id: string; impact: string; nodes: Array<unknown> }> }> } }).axe.run(document, {
      resultTypes: ["violations"],
    });
    return result.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => `${violation.id} (${violation.impact}, ${violation.nodes.length}: ${(violation.nodes[0] as unknown as { html?: string })?.html?.slice(0, 90) ?? ""})`);
  });

  if (def.path === "/") await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  return { page: def.path, width, issues, axe, shot };
}

(async () => {
  mkdirSync(".context/qa/shots", { recursive: true });
  const browser: Browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const findings: Finding[] = [];

  for (const def of PAGES) {
    for (const width of WIDTHS) {
      const context: BrowserContext = await browser.newContext({
        viewport: { width: width.width, height: width.height },
        hasTouch: width.touch,
      });
      const token = cookieFor(def.role);
      if (token) await context.addCookies([{ name: "ro_session", value: token, domain: "localhost", path: "/" }]);
      const page = await context.newPage();
      try {
        await page.goto(`${BASE}${def.path}`, { waitUntil: "domcontentloaded", timeout: 40000 });
        await page.waitForTimeout(def.path === "/" ? 2200 : 1100);
        const shot = `.context/qa/shots/${def.name}-${width.name}.png`;
        const finding = await audit(page, def, width.name, shot);
        findings.push(finding);
        const status = finding.issues.length || finding.axe.length ? "FAIL" : "PASS";
        console.log(`${status} ${def.name} ${width.name}${finding.issues.length ? ` :: ${finding.issues.join(" ; ")}` : ""}${finding.axe.length ? ` :: axe ${finding.axe.join(",")}` : ""}`);
      } catch (error) {
        console.log(`ERROR ${def.name} ${width.name} :: ${error instanceof Error ? error.message : String(error)}`);
        findings.push({ page: def.path, width: width.name, issues: [`error: ${error instanceof Error ? error.message : String(error)}`], axe: [], shot: "" });
      } finally {
        await context.close();
      }
    }
  }

  writeFileSync(".context/qa/visual-qa.json", JSON.stringify(findings, null, 2));
  const failures = findings.filter((finding) => finding.issues.length || finding.axe.length);
  console.log(`\n${findings.length} page/width checks, ${failures.length} with findings`);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
