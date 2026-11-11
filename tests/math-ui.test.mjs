/**
 * BROWSER TESTS for the math question card (headless Edge/Chrome). Run: npm run test:math-ui (needs `npm run dev`).
 * Desktop + phone emulation, logged in as a temporary student (deleted afterwards). No AI calls.
 * Screenshots go to SCREENSHOT_DIR when it is set.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import puppeteer, { KnownDevices } from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

process.loadEnvFile(new URL("../.env.local", import.meta.url));
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOT_DIR;
const LESSON = "/mathematics/grade-9/unit-1/1-1";
const BROWSERS = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter(Boolean);
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let browser, user, cookies;
const problems = [];

before(async () => {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const username = `mui_${randomBytes(3).toString("hex")}`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email: `${username}@users.unitysocialrem.app`, password, email_confirm: true, user_metadata: { username } });
  if (error) throw error;
  user = data.user;
  const jar = new Map();
  const sb = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) } });
  const r = await sb.auth.signInWithPassword({ email: `${username}@users.unitysocialrem.app`, password });
  if (r.error) throw r.error;
  cookies = [...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" }));
  browser = await puppeteer.launch({ executablePath: BROWSERS.find((p) => existsSync(p)), headless: true, args: ["--no-first-run", "--disable-extensions"] });
  await browser.setCookie(...cookies);
});

after(async () => {
  await browser?.close();
  if (user) await admin.auth.admin.deleteUser(user.id);
});

async function open(path, device) {
  const page = await browser.newPage();
  if (device) await page.emulate(device);
  else await page.setViewport({ width: 1280, height: 900 });
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warn") && !/React DevTools|\[HMR\]|\[Fast Refresh\]/.test(m.text())) problems.push(`${path}: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => problems.push(`${path}: pageerror ${e.message.slice(0, 200)}`));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 60_000 });
  return page;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }) : null);

/** Click the first visible button whose text contains `text` (inside `scope`, default the page). */
async function click(page, text, scope = "body") {
  const ok = await page.evaluate(
    (text, scope) => {
      const root = document.querySelector(scope) ?? document.body;
      const el = [...root.querySelectorAll("button, [role=tab]")].find((b) => b.textContent?.includes(text) && b.getClientRects().length);
      el?.click();
      return !!el;
    },
    text,
    scope,
  );
  assert.ok(ok, `button "${text}" not found`);
  await pause(450);
}
const text = (page, sel = "body") => page.$eval(sel, (e) => e.innerText);

/** Open the Homework tab; list = "homework" | "practice"; n = position in the picker (1-based, warm-up included). */
async function homework(page, n, list = "homework") {
  await click(page, "Homework");
  await page.waitForSelector("article");
  if (list === "practice") await click(page, "Extra practice");
  await page.evaluate((n) => [...document.querySelectorAll('[role=tablist][aria-label$="exercises"] [role=tab]')][n - 1].click(), n);
  await pause(600);
}

test("Extra practice 3: ONE card, 5 labelled lines, ONE Check, score per part", async () => {
  const page = await open(LESSON);
  await homework(page, 3, "practice");
  const inputs = await page.$$("article input[aria-label]");
  assert.equal(inputs.length, 5, "one line per part");
  const answers = ["{2, 3, 4, 6, 8, 9, 10}", "{6}", "{1, 3, 5, 7}", "{10, 8, 4, 2}", "{2,3,4,8,9,10,2}"]; // A′ wrong on purpose
  for (let i = 0; i < 5; i++) await inputs[i].type(answers[i]);
  const checks = await page.$$eval("article button", (bs) => bs.filter((b) => b.textContent?.trim() === "Check").length);
  assert.equal(checks, 1, "exactly one Check button");
  await click(page, "Check", "article");
  await pause(500);
  const t = await text(page, "article");
  assert.match(t, /4 \/ 5 parts correct/);
  assert.match(t, /missing 1 element/);
  await shot(page, "1-exercise3-desktop");
  await page.close();
});

test("choice question: big options + calculation paper + calculator in the card", async () => {
  const page = await open(LESSON);
  await homework(page, 6);
  assert.match(await text(page, "article"), /40 boys/);
  await click(page, "Calculator", "article");
  for (const k of ["7", "×", "8", "="]) await page.evaluate((k) => [...document.querySelectorAll('[role=dialog][aria-label=Calculator] button')].find((b) => b.textContent === k)?.click(), k);
  await pause(200);
  assert.match(await text(page, "[role=dialog][aria-label=Calculator]"), /= 56/);
  await page.evaluate(() => document.querySelector('[aria-label="Close calculator"]')?.click());
  await click(page, "Open calculation paper", "article");
  await page.waitForSelector('[role=dialog][aria-label="Calculation paper"] canvas');
  const box = await (await page.$('[role=dialog][aria-label="Calculation paper"] canvas')).boundingBox();
  await page.mouse.move(box.x + 60, box.y + 80);
  await page.mouse.down();
  for (let i = 0; i < 20; i++) await page.mouse.move(box.x + 60 + i * 8, box.y + 80 + Math.sin(i / 2) * 20);
  await page.mouse.up();
  await pause(300);
  await shot(page, "2-calculation-paper-desktop");
  await page.keyboard.press("Escape");
  await pause(400);
  await page.evaluate(() => [...document.querySelectorAll("article button")].find((b) => /^[A-D]9$/.test(b.textContent?.replace(/s/g, "") ?? ""))?.click());
  await pause(500);
  assert.match(await text(page, "article"), /Correct!/);
  await shot(page, "3-choice-desktop");
  await page.close();
});

test("homework 1: numbered drawing, grouped lines + Equal/Not equal, ONE Check, then left vs right side by side", async () => {
  const page = await open(LESSON);
  await homework(page, 2); // W, 1 → "Homework 1"
  const t0 = await text(page, "article");
  assert.match(t0, /HOMEWORK 1/i);
  assert.match(t0, /Left side[\s\S]*Right side[\s\S]*Conclusion/i);
  const inputs = await page.$$("article input[aria-label]");
  assert.equal(inputs.length, 5);
  const answers = ["{6, 7}", "{1, 4, 5, 6, 7}", "{1, 2, 4, 5, 6, 7}", "{1, 3, 4, 5, 6, 7}", "{7, 6, 5, 4, 1}"];
  for (let i = 0; i < 5; i++) await inputs[i].type(answers[i]);
  await click(page, "Equal ✓", "article");
  await click(page, "Check", "article");
  await pause(800);
  assert.match(await text(page, "article"), /6 \/ 6 parts correct/);
  const figures = await page.$$("article figure svg");
  assert.ok(figures.length >= 3, "the numbered drawing + left and right side diagrams");
  await shot(page, "4a-numbered-drawing-desktop");
  await page.close();
});

test("practice 'show that' with shading: two diagrams, shade mode, one Check", async () => {
  const page = await open(LESSON);
  await homework(page, 5, "practice");
  const diagrams = await page.$$('article svg[aria-label="Tap the regions to shade them"]');
  assert.equal(diagrams.length, 2);
  assert.match(await text(page, "article"), /Left side[\s\S]*Right side/);
  await shot(page, "4b-venn-shading-desktop");
  await page.close();
});

test("quiz uses the same card", async () => {
  const page = await open(LESSON);
  await click(page, "Quiz");
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Start Quiz/.test(b.textContent ?? "") && !b.disabled), { timeout: 20_000 });
  await click(page, "Start Quiz");
  await page.waitForSelector("article");
  const t = await text(page, "article");
  assert.match(t, /QUESTION 1/i);
  assert.match(t, /Open calculation paper/);
  await shot(page, "5-quiz-card-desktop");
  await page.close();
});

test("phone: written answer = full-width lines; handwriting opens a full-screen sheet", async () => {
  const page = await open(LESSON, KnownDevices["iPhone 13"]);
  await homework(page, 3, "practice");
  await shot(page, "6-exercise3-phone-typing");
  await click(page, "Write by hand", "article");
  await pause(600);
  await page.evaluate(() => document.querySelector('[aria-label="Open the answer paper to write"]')?.click());
  await page.waitForSelector('[role=dialog][aria-label="Answer paper"] canvas', { timeout: 10_000 });
  await pause(800); // let the sheet finish sliding in
  const c = await (await page.$('[role=dialog][aria-label="Answer paper"] canvas')).boundingBox();
  assert.ok(c.width > 330, `writing area uses the full width (${c.width})`);
  await page.touchscreen.touchStart(c.x + 40, c.y + 60);
  for (let i = 0; i < 15; i++) await page.touchscreen.touchMove(c.x + 40 + i * 10, c.y + 60 + (i % 2) * 8);
  await page.touchscreen.touchEnd();
  await pause(300);
  await shot(page, "7-answer-paper-sheet-phone");
  await page.evaluate(() => document.querySelector('[role=dialog][aria-label="Answer paper"] [aria-label=Close]')?.click());
  await page.close();
});

test("phone: selecting notes text shows 'Explain further' BELOW the selection", async () => {
  const page = await open(LESSON, KnownDevices["Pixel 7"] ?? KnownDevices["Pixel 5"]);
  const rect = await page.evaluate(() => {
    const p = document.querySelector("[data-tutor-notes] p");
    const r = document.createRange();
    r.selectNodeContents(p);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    const b = r.getBoundingClientRect();
    return { bottom: b.bottom };
  });
  await pause(700);
  const pill = await page.$('[role=toolbar][aria-label="Explain further"]');
  assert.ok(pill, "the pill appears on a phone");
  const pb = await pill.boundingBox();
  assert.ok(pb.y >= rect.bottom - 1 || pb.y > 500, `pill (${pb.y}) is below the selection (${rect.bottom})`);
  await shot(page, "8-selection-pill-phone");
  await page.close();
});

test("Text tool + Select tool on the paper; a typed answer line is checked with NO AI call", async () => {
  const page = await open(LESSON);
  const aiCalls = [];
  page.on("request", (r) => r.url().includes("/api/handwriting") && aiCalls.push(r.url()));
  await homework(page, 3, "practice");
  // the choice is remembered per device: switch to the paper only if needed
  if (!(await page.$("article [data-ink-paper] canvas"))) await click(page, "Write by hand", "article");
  await page.waitForSelector("article [data-ink-paper] canvas");
  const c = await (await page.$("article [data-ink-paper] canvas")).boundingBox();
  // start from an empty paper (ink is saved per question on this device)
  await page.evaluate(() => document.querySelector('article [aria-label="Clear"]:not([disabled])')?.click());
  await pause(200);
  // Text tool (T), click on line 1, type with a shortcut
  await page.keyboard.press("t");
  await page.mouse.click(c.x + 190, c.y + 52);
  await page.waitForSelector("article [data-ink-paper] input[aria-label=Text]");
  await page.keyboard.type("{2, 3, 4, 6, 8, 9, 10} ");
  await page.keyboard.sendCharacter("\\"); // puppeteer: keyboard.type() drops backslashes
  await page.keyboard.type("cup ");
  const typed = await page.$eval("article [data-ink-paper] input[aria-label=Text]", (i) => i.value);
  assert.match(typed, /∪/, "\cup became ∪");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace"); // remove " ∪ "
  await page.keyboard.press("Enter");
  await pause(300);
  await shot(page, "9a-text-tool-desktop");
  // Select tool (V): click the text box, delete it, undo
  await page.keyboard.press("v");
  await page.mouse.click(c.x + 200, c.y + 50);
  await pause(300);
  assert.ok(await page.$('article [role=toolbar][aria-label="Selection options"]'), "selected: floating bar");
  await shot(page, "9b-select-tool-desktop");
  await page.keyboard.press("Delete");
  await pause(200);
  await page.keyboard.down("Control");
  await page.keyboard.press("z");
  await page.keyboard.up("Control");
  await pause(300);
  // Check: the typed line is read directly (no AI)
  await click(page, "Check", "article");
  await pause(800);
  const t = await text(page, "article");
  assert.match(t, /I read:/);
  assert.deepEqual(aiCalls, [], "typed text never goes to the AI");
  await shot(page, "9c-typed-line-checked-desktop");
  await page.close();
});

test("no console errors or warnings on any of these screens", () => {
  assert.deepEqual(problems, []);
});
