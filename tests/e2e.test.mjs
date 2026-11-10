/**
 * BROWSER TESTS (headless Edge/Chrome via puppeteer-core). Run: npm run test:e2e   (needs `npm run dev`)
 *  1. Every student page and every admin page loads with ZERO console errors or warnings.
 *  2. Deleting a user in Admin → Users removes the row WITHOUT a page reload.
 * Creates temporary users with the secret key and deletes them afterwards. Prints no secrets.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

process.loadEnvFile(new URL("../.env.local", import.meta.url));
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const BROWSERS = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
].filter(Boolean);

const created = [];
async function makeUser(prefix) {
  const username = `${prefix}_${randomBytes(3).toString("hex")}`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email: `${username}@users.unitysocialrem.app`, password, email_confirm: true, user_metadata: { username } });
  if (error) throw error;
  created.push(data.user.id);
  return { id: data.user.id, username, password };
}

function totp(secret) {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += a.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Signs in (and does 2FA for admins) like the browser would; returns the session cookies. */
async function sessionCookies(u, withMfa) {
  const jar = new Map();
  const sb = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) } });
  const { error } = await sb.auth.signInWithPassword({ email: `${u.username}@users.unitysocialrem.app`, password: u.password });
  if (error) throw error;
  if (withMfa) {
    const en = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "e2e" });
    if (en.error) throw en.error;
    const v = await sb.auth.mfa.challengeAndVerify({ factorId: en.data.id, code: totp(en.data.totp.secret) });
    if (v.error) throw v.error;
  }
  return [...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" }));
}

let browser;
let adminUser;
let adminCookies;

before(async () => {
  const exe = BROWSERS.find((p) => existsSync(p));
  assert.ok(exe, "No Edge/Chrome found (set BROWSER_PATH)");
  browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-first-run", "--disable-extensions"] });
  adminUser = await makeUser("e2e_admin");
  const { error } = await admin.from("profiles_private").update({ role: "admin" }).eq("id", adminUser.id);
  if (error) throw error;
  adminCookies = await sessionCookies(adminUser, true);
});

after(async () => {
  await browser?.close();
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

/** Opens a page and returns console errors/warnings and uncaught exceptions. */
async function visit(path, cookies, { wait = 1500 } = {}) {
  const page = await browser.newPage();
  if (cookies) await browser.setCookie(...cookies);
  const problems = [];
  page.on("console", (m) => {
    const type = m.type();
    if (type !== "error" && type !== "warn") return;
    const text = m.text();
    // Development-only notices from the tooling itself, not from the app.
    if (/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(text)) return;
    problems.push(`${type}: ${text.slice(0, 300)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 300)}`));
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 60_000 });
  await new Promise((r) => setTimeout(r, wait));
  return { page, problems, status: res?.status() ?? 0 };
}

const STUDENT_PAGES = [
  "/",
  "/geography",
  "/geography/grade-9",
  "/geography/grade-9/unit-1",
  "/geography/grade-9/unit-1/1-1-4",
  "/schedule",
  "/login",
  "/signup",
];
const ADMIN_PAGES = ["/admin", "/admin/users", "/admin/content", "/admin/quizzes", "/admin/ai", "/admin/schedule", "/admin/announcements", "/admin/settings", "/admin/system", "/admin/audit"];

test("student pages: no console errors or warnings", async () => {
  await browser.deleteCookie(...(await browser.cookies()));
  for (const path of STUDENT_PAGES) {
    const { page, problems, status } = await visit(path, null);
    assert.equal(status, 200, `${path} → ${status}`);
    assert.deepEqual(problems, [], `${path} console problems`);
    await page.close();
  }
});

test("lesson: Learn mode, Read all, Main Topics, quiz and the Rem chat open without console errors", async () => {
  const { page, problems } = await visit("/geography/grade-9/unit-1/1-1-4", null);
  const click = async (text) => {
    const ok = await page.evaluate((t) => {
      const el = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().includes(t));
      el?.click();
      return !!el;
    }, text);
    await new Promise((r) => setTimeout(r, 900));
    return ok;
  };
  assert.ok(await click("Read all"));
  assert.ok(await click("Main Topics"));
  assert.ok(await click("Quiz"));
  await click("Start");
  await page.goto(`${BASE}/geography/grade-9/unit-1/1-1-4`, { waitUntil: "networkidle2" });
  await page.evaluate(() => document.querySelector("button[aria-label='Ask Rem']")?.click());
  await new Promise((r) => setTimeout(r, 2500));
  assert.deepEqual(problems, [], "lesson console problems");
  await page.close();
});

test("admin pages (with 2FA): no console errors or warnings", async () => {
  for (const path of ADMIN_PAGES) {
    const { page, problems, status } = await visit(path, adminCookies);
    assert.equal(status, 200, `${path} → ${status}`);
    assert.deepEqual(problems, [], `${path} console problems`);
    await page.close();
  }
});

test("deleting a user removes the row from the list immediately, without a page reload", async () => {
  const victim = await makeUser("e2e_delete_me");
  const { page, problems } = await visit("/admin/users", adminCookies);
  await page.evaluate(() => (window.__noReload = true));

  const row = `tr[data-row-key="${victim.id}"]`;
  await page.waitForSelector(row, { timeout: 15_000 });
  await page.click(`${row} input[type=checkbox]`);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Delete")?.click());
  await page.waitForSelector("[role=dialog] input", { timeout: 5000 });
  await page.type("[role=dialog] input", `@${victim.username}`);
  await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent?.trim() === "Delete forever")?.click());

  // Gone from the list at once (optimistic), and still gone after the server confirms.
  try {
    await page.waitForSelector(row, { hidden: true, timeout: 4000 });
  } catch {
    const state = await page.evaluate(() => ({
      dialog: document.querySelector("[role=dialog]")?.textContent?.slice(0, 300) ?? null,
      typed: document.querySelector("[role=dialog] input")?.value ?? null,
      buttons: [...document.querySelectorAll("[role=dialog] button")].map((b) => `${b.textContent?.trim()}${b.disabled ? " (disabled)" : ""}`),
      toasts: document.querySelector("[aria-live=polite]")?.textContent ?? "",
    }));
    assert.fail(`row still visible: ${JSON.stringify(state)} problems=${JSON.stringify(problems)}`);
  }
  await new Promise((r) => setTimeout(r, 4000));
  assert.equal(await page.$(row), null, "row must stay removed after the server confirms");
  assert.equal(await page.evaluate(() => window.__noReload === true), true, "the page must not have reloaded");
  const { data } = await admin.from("profiles").select("id").eq("id", victim.id).maybeSingle();
  assert.equal(data, null, "the user is really deleted in the database");
  assert.deepEqual(problems, [], "no console problems while deleting");
  await page.close();
});
