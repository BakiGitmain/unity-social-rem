/**
 * BROWSER TESTS for Notes (headless Edge/Chrome). Run: npm run test:notes-ui (needs `npm run dev`).
 * A temporary student (deleted afterwards). No AI calls: Rem's answer for "Save to notes" is seeded.
 * Screenshots go to SCREENSHOT_DIR when it is set.
 */
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import puppeteer, { KnownDevices } from "puppeteer-core";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

process.loadEnvFile(new URL("../.env.local", import.meta.url));
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOT_DIR;
const GEO = "/geography/grade-9/unit-1/1-1-4";
const MATH = "/mathematics/grade-9/unit-1/1-1";
const BROWSERS = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter(Boolean);
const service = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let browser, user, boardUrl;
const problems = [];
let current = "";
beforeEach((t) => {
  current = t.name;
});
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, name) => (SHOTS ? p.screenshot({ path: `${SHOTS}/${name}.png` }) : null);

before(async () => {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const username = `nui_${randomBytes(3).toString("hex")}`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await service.auth.admin.createUser({ email: `${username}@users.unitysocialrem.app`, password, email_confirm: true, user_metadata: { username } });
  if (error) throw error;
  user = data.user;
  const jar = new Map();
  const sb = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) } });
  const r = await sb.auth.signInWithPassword({ email: `${username}@users.unitysocialrem.app`, password });
  if (r.error) throw r.error;
  // a saved Rem answer for this lesson (so "Save to notes" can be tested without an AI call)
  const { data: lesson } = await service.from("lessons").select("id").eq("slug", "1-1-4").single();
  await service.from("ai_chats").upsert({
    user_id: user.id,
    lesson_id: lesson.id,
    messages: [
      { id: "u1", role: "user", parts: [{ type: "text", text: "What is a theme in geography?" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "A **theme** is a big idea geographers use to study places, like location or movement." }] },
    ],
  });
  browser = await puppeteer.launch({ executablePath: BROWSERS.find((p) => existsSync(p)), headless: true, args: ["--no-first-run", "--disable-extensions"] });
  await browser.setCookie(...[...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })));
});

after(async () => {
  await browser?.close();
  if (user) await service.auth.admin.deleteUser(user.id);
});

async function open(path, device) {
  const page = await browser.newPage();
  if (device) await page.emulate(device);
  else await page.setViewport({ width: 1366, height: 900 });
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warn") && !/React DevTools|\[HMR\]|\[Fast Refresh\]|Failed to load resource/.test(m.text())) problems.push(`[${current}] ${path}: ${m.text().slice(0, 220)}`);
  });
  page.on("pageerror", (e) => problems.push(`${path}: pageerror ${e.message.slice(0, 200)}`));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 90_000 });
  return page;
}
/** Click the first visible element whose text (or aria-label) contains `text`. */
async function click(page, text, sel = "button, a, [role=menuitem], [role=radio], [role=tab]") {
  const ok = await page.evaluate(
    (text, sel) => {
      const el = [...document.querySelectorAll(sel)].find((b) => (b.textContent?.includes(text) || b.getAttribute("aria-label") === text) && b.getClientRects().length);
      el?.click();
      return !!el;
    },
    text,
    sel,
  );
  assert.ok(ok, `"${text}" not found`);
  await pause(400);
}
const nodeCount = (page) => page.$$eval(".react-flow__node", (n) => n.length);
/** Wait until the board has finished saving (autosave waits ~800 ms after the last change). */
async function settled(page) {
  await pause(1300);
  await page.waitForFunction(() => !/Saving…/.test(document.body.innerText), { timeout: 15_000 });
}
/** Cards (from the database) that overlap another card: new cards must go in an empty spot. */
async function overlapping(boardId) {
  const { data } = await service.from("board_nodes").select("id, type, x, y, w, h, parent_id").eq("board_id", boardId);
  const free = data.filter((n) => !n.parent_id && n.type !== "frame");
  const out = [];
  for (const a of free)
    for (const b of free)
      if (a.id < b.id && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) out.push(`${a.type}×${b.type}`);
  return out;
}
/** Every card is drawn and fully inside the canvas (cards outside the view are not drawn at all). */
async function allInView(page, total) {
  const r = await page.evaluate(() => {
    const box = document.querySelector(".react-flow").getBoundingClientRect();
    const nodes = [...document.querySelectorAll(".react-flow__node")].map((n) => n.getBoundingClientRect());
    return { n: nodes.length, inside: nodes.every((b) => b.left >= box.left - 1 && b.right <= box.right + 1 && b.top >= box.top - 1 && b.bottom <= box.bottom + 1) };
  });
  assert.equal(r.n, total, "every card is drawn (in view)");
  assert.ok(r.inside, "every card is inside the visible area");
}
const status = (page) => page.evaluate(() => document.body.innerText.match(/Saved on this device|Saved|Saving…|Offline[^\n]*/)?.[0] ?? "");

test("Notes is in the navigation (desktop + phone)", async () => {
  const page = await open("/");
  assert.ok(await page.$('nav a[href$="/notes"]'), "desktop nav has Notes");
  await page.close();
  const phone = await open("/", KnownDevices["iPhone 13"]);
  assert.ok(await phone.$('nav.fixed a[href$="/notes"]'), "bottom bar has Notes");
  const tabs = await phone.$$eval("nav.fixed a, nav.fixed button", (x) => x.length);
  assert.equal(tabs, 4, "Home · Schedule · Notes · Profile");
  await shot(phone, "n1-bottom-bar-phone");
  await phone.close();
});

test("create a board from a lesson with a template", async () => {
  const page = await open(GEO);
  await page.waitForSelector('[aria-label="Boards for this lesson"]', { timeout: 20_000 });
  await page.click('[aria-label="Boards for this lesson"]');
  await pause(600);
  await click(page, "New board");
  await page.type('[role=dialog] input[maxlength="120"]', "Themes mind map");
  await click(page, "Mind map");
  await shot(page, "n2-new-board-sheet");
  await click(page, "Create", "[role=dialog] button");
  await page.waitForFunction(() => location.pathname.includes("/notes/board"), { timeout: 20_000 });
  await page.waitForSelector(".react-flow__node", { timeout: 30_000 });
  boardUrl = new URL(page.url()).pathname + new URL(page.url()).search;
  assert.equal(await nodeCount(page), 5, "mind map: centre + 4 branches");
  assert.match(await page.evaluate(() => document.body.innerText), /Geography · 1\.1\.4/);
  await page.close();
});

test("add every card type, connect two cards with a labelled arrow, tidy up, outline, saved", async () => {
  const page = await open(boardUrl);
  await page.waitForSelector(".react-flow__node", { timeout: 30_000 });
  await pause(500);
  // connect: card menu → Connect… → tap the target card → label the arrow
  // two branches of the mind map (the centre is already linked to every branch)
  const handles = await page.$$(".react-flow__node");
  const texts = await Promise.all(handles.map((h) => h.evaluate((e) => e.innerText)));
  const from = handles[texts.findIndex((t) => t.includes("Branch 1"))];
  const to = handles[texts.findIndex((t) => t.includes("Branch 2"))];
  const before = await page.$$eval(".react-flow__edge", (e) => e.length);
  const b0 = await from.boundingBox();
  await page.mouse.click(b0.x + b0.width / 2, b0.y + b0.height / 2, { button: "right" });
  await pause(300);
  await click(page, "Connect…", "[role=menu] button");
  const b1 = await to.boundingBox();
  await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2); // the centre (the edge has the connection dot)
  await pause(400);
  assert.equal(await page.$$eval(".react-flow__edge", (e) => e.length), before + 1, "a new arrow");
  await page.type('[aria-label="Arrow label"]', "causes");
  await page.keyboard.press("Enter");
  await pause(400);
  assert.match(await page.$$eval(".react-flow__edge-text", (t) => t.map((x) => x.textContent).join("|")), /causes/);
  await shot(page, "n3-board-cards-arrow");

  await page.mouse.click(30, 300);
  await settled(page);
  const dbCount = async () => (await service.from("board_nodes").select("id", { count: "exact", head: true }).eq("board_id", new URLSearchParams(boardUrl.split("?")[1]).get("id"))).count;
  const start = await dbCount();
  for (const label of ["Note card", "Sticky note", "Lesson quote", "Image", "Drawing", "Link", "Checklist", "Frame / group"]) {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Add")?.click());
    await pause(350);
    await click(page, label, "[role=menu] button");
    await pause(450);
    if (label === "Drawing") await click(page, "Done");
    await page.keyboard.press("Escape");
    await page.mouse.click(30, 300); // the paper: finish editing
    await pause(250);
  }
  await settled(page);
  assert.equal(await dbCount(), start + 8, "8 card types added (the view pans to each new card)");
  assert.deepEqual(await overlapping(new URLSearchParams(boardUrl.split("?")[1]).get("id")), [], "new cards never land on another card");
  // line breaks: a note with two lines shows two lines
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Add")?.click());
  await pause(350);
  await click(page, "Note card", "[role=menu] button");
  await pause(450);
  await page.type('.react-flow__node textarea[aria-label="Card text"]', "first line");
  await page.keyboard.down("Shift");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Shift");
  await page.keyboard.type("second line");
  await page.mouse.click(30, 300);
  await pause(400);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll(".react-flow__node")].some((n) => n.innerText.includes("first line\nsecond line") && n.querySelector("br"))), "a single newline stays a line break");

  // image: upload a small photo into the image card
  const png = join(tmpdir(), `notes-${Date.now()}.png`);
  writeFileSync(png, await sharp({ create: { width: 320, height: 200, channels: 3, background: "#0f766e" } }).png().toBuffer());
  const file = await page.$('.react-flow__node input[type=file]');
  assert.ok(file, "the image card asks for a photo");
  await file.uploadFile(png);
  await page.waitForFunction(() => !!document.querySelector(".react-flow__node img"), { timeout: 20_000 });

  // tidy up, then outline view
  await page.mouse.click(30, 300);
  await page.keyboard.press("t");
  await settled(page);
  const { count: total } = await service.from("board_nodes").select("id", { count: "exact", head: true }).eq("board_id", new URLSearchParams(boardUrl.split("?")[1]).get("id"));
  await allInView(page, total); // Tidy fits every card into view
  await shot(page, "n4-tidy");
  await page.mouse.click(30, 300);
  await page.keyboard.press("f");
  await pause(700);
  await allInView(page, total); // F = fit to screen
  await click(page, "Outline");
  await page.waitForSelector("#notes-outline");
  assert.match(await page.$eval("#notes-outline", (e) => e.innerText), /linked to[\s\S]*causes/);
  const firstItem = await page.$eval("#notes-outline li", (e) => e.innerText);
  assert.match(firstItem, /The main idea/, "the outline starts from the root card (the mind-map centre)");
  await shot(page, "n5-outline");
  await click(page, "Board view");

  // "Saving…" → "Saved ✓", which fades after ~2 s
  await page.mouse.click(30, 300);
  await page.keyboard.press("s"); // a new sticky note
  await pause(300);
  await page.keyboard.type("saved?");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => /\bSaved\b/.test(document.body.innerText), { timeout: 15_000 });
  await page.waitForFunction(() => !/\bSaved\b/.test(document.body.innerText), { timeout: 6_000 });
  // still there after a reload
  const saved = await nodeCount(page);
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector(".react-flow__node", { timeout: 30_000 });
  await pause(800);
  assert.equal(await nodeCount(page), saved, "every card is saved");
  await page.close();
});

test("offline: changes stay on the device and sync when back online", async () => {
  const page = await open(boardUrl);
  await page.waitForSelector(".react-flow__node", { timeout: 30_000 });
  const n0 = await nodeCount(page);
  await page.setOfflineMode(true);
  await page.mouse.click(30, 300);
  await page.keyboard.press("s"); // new sticky note
  await pause(300);
  await page.keyboard.type("written offline");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => /Offline/.test(document.body.innerText), { timeout: 15_000 });
  assert.match(await status(page), /Offline/);
  await shot(page, "n6-offline");
  await page.setOfflineMode(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => /\bSaved\b/.test(document.body.innerText), { timeout: 20_000 });
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector(".react-flow__node", { timeout: 30_000 });
  await pause(800);
  assert.equal(await nodeCount(page), n0 + 1, "the offline card reached the account");
  await page.close();
});

test("lesson → 'Add to notes' (selected text) and Rem → 'Save to notes'", async () => {
  const page = await open(GEO);
  await page.waitForSelector("[data-tutor-notes] p");
  await page.evaluate(() => {
    const p = document.querySelector("[data-tutor-notes] p");
    const r = document.createRange();
    r.selectNodeContents(p);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  });
  await pause(700);
  await click(page, "Add to notes", "[role=toolbar] button");
  await page.waitForSelector('[role=dialog][aria-label="Which board?"] ul button', { timeout: 10_000 });
  await pause(400);
  assert.equal(await page.$('[aria-label^="Ask Rem"]'), null, "Rem steps aside while a sheet is open");
  assert.equal(await page.$('[aria-label="Boards for this lesson"]'), null, "the notes button too");
  await pause(500); // the sheet slides in
  await page.evaluate(() => document.querySelector('[role=dialog][aria-label="Which board?"] ul button').click());
  await page.waitForFunction(() => /Added to/.test(document.body.innerText), { timeout: 10_000 });
  await shot(page, "n7-added-quote");

  // Rem: open the chat (the seeded answer is there) → Save to notes
  await page.waitForFunction(() => !/Added to/.test(document.body.innerText), { timeout: 10_000 }); // first toast gone
  await page.click('[aria-label^="Ask Rem"]');
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.getAttribute("aria-label") === "Save to notes"), { timeout: 20_000 });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Save to notes").click());
  await page.waitForSelector('[role=dialog][aria-label="Which board?"] ul button', { timeout: 10_000 });
  await pause(500); // the sheet slides in
  await page.evaluate(() => document.querySelector('[role=dialog][aria-label="Which board?"] ul button').click());
  await page.waitForFunction(() => /Added to/.test(document.body.innerText), { timeout: 10_000 });
  await page.close();

  // both cards are on the board (checked in the database: off-screen cards are not drawn)
  const id = new URLSearchParams(boardUrl.split("?")[1]).get("id");
  const { data: cards } = await service.from("board_nodes").select("type, data").eq("board_id", id);
  assert.ok(cards.some((c) => c.type === "note" && c.data.title === "What is a theme in geography?" && /theme/.test(c.data.body ?? "")), "Rem's answer is a card titled with the student's question");
  assert.ok(cards.some((c) => c.type === "quote" && c.data.quote?.href?.includes("?part=")), "a lesson quote card linking back to its part");
});

test("flashcards: make one, the Notes tab shows it due, review it", async () => {
  const page = await open(boardUrl);
  await page.waitForSelector(".react-flow__node", { timeout: 30_000 });
  const all = await page.$$(".react-flow__node");
  const labels = await Promise.all(all.map((h) => h.evaluate((e) => e.innerText)));
  const node = all[labels.findIndex((t) => t.includes("Branch 1"))];
  const b = await node.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { button: "right" });
  await pause(300);
  await click(page, "Make flashcard", "[role=menu] button");
  await page.waitForSelector('[role=dialog][aria-label="Make a flashcard"] textarea', { timeout: 10_000 });
  const [front, back] = await page.$$eval('[role=dialog][aria-label="Make a flashcard"] textarea', (t) => t.map((x) => x.value));
  assert.match(front, /Branch 1/, "front pre-filled from the title");
  await page.click('[role=dialog][aria-label="Make a flashcard"] textarea:last-of-type', { clickCount: 3 });
  await page.focus('[role=dialog][aria-label="Make a flashcard"] label:last-of-type textarea');
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.type("My own answer");
  await click(page, "Save flashcard", '[role=dialog] button');
  await page.waitForFunction(() => /Flashcard made/.test(document.body.innerText), { timeout: 10_000 });
  await page.close();
  const { data: fc } = await service.from("flashcards").select("front, back").eq("board_id", new URLSearchParams(boardUrl.split("?")[1]).get("id"));
  assert.ok(fc.some((c) => /Branch 1/.test(c.front) && c.back === "My own answer"), "the edited front/back are saved (" + back.slice(0, 20) + ")");

  const home = await open("/notes");
  await home.waitForFunction(() => /1 card due today/.test(document.body.innerText), { timeout: 15_000 });
  assert.ok(await home.$('nav a[href$="/notes"] [aria-label="1 due"]'), "badge on the Notes tab");
  await shot(home, "n8-notes-home");
  await click(home, "Review now");
  await home.waitForSelector(".flip-inner", { timeout: 15_000 });
  await home.click(".flip-inner");
  await pause(700);
  await shot(home, "n9-review-flipped");
  await click(home, "Good");
  await home.waitForFunction(() => /All done/.test(document.body.innerText), { timeout: 10_000 });
  await home.close();
});

test("calculation tools only on math questions", async () => {
  const geo = await open(GEO);
  await click(geo, "Quiz", "[role=tab]");
  await geo.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Start Quiz/.test(b.textContent ?? "") && !b.disabled), { timeout: 20_000 });
  await click(geo, "Start Quiz");
  await geo.waitForSelector("article");
  const g = await geo.$eval("article", (e) => e.innerText);
  assert.doesNotMatch(g, /calculation paper|Calculator/i, "no calculation tools on Geography");
  await geo.close();
  const math = await open(MATH);
  await click(math, "Homework", "[role=tab]");
  await math.waitForSelector("article");
  await math.evaluate(() => [...document.querySelectorAll('[role=tablist][aria-label$="exercises"] [role=tab]')][5].click()); // exam question
  await pause(500);
  assert.match(await math.$eval("article", (e) => e.innerText), /Calculator/, "math choice question has the calculator");
  await math.close();
});

test("phone: board opens in outline view under 400px, with the bottom toolbar", async () => {
  const page = await open(boardUrl, KnownDevices["iPhone SE"]);
  await page.waitForSelector("#notes-outline", { timeout: 30_000 });
  for (const label of ["Add", "Select", "Connect", "Tidy", "Undo"]) assert.ok(await page.evaluate((l) => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === l), label), `${label} in the toolbar`);
  await shot(page, "n10-phone-outline");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((e) => e.textContent?.trim() === "Board" && e.getClientRects().length)?.click());
  await page.waitForSelector(".react-flow__node", { timeout: 15_000 });
  await shot(page, "n11-phone-board");
  // edit a note card full screen: the TITLE field is there and nothing covers it
  const note = await page.evaluateHandle(() => [...document.querySelectorAll(".react-flow__node")].find((n) => n.innerText.includes("Branch 2")));
  await (await note.$('[aria-label="Card menu"]')).evaluate((b) => b.click());
  await pause(300);
  await click(page, "Edit", "[role=menu] button");
  await page.waitForSelector('[role=dialog][aria-label="Edit card"] input[aria-label="Title"]', { visible: true, timeout: 10_000 });
  await pause(600);
  const onTop = await page.evaluate(() => {
    const el = document.querySelector('[role=dialog][aria-label="Edit card"] input[aria-label="Title"]');
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el;
  });
  assert.ok(onTop, "the title field is visible above the site header");
  await shot(page, "n12-phone-editor");
  await click(page, "Done");
  await page.close();
});

test("no console errors or warnings", () => {
  assert.deepEqual(problems, []);
});
