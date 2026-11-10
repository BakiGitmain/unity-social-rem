/**
 * SECURITY TESTS for the admin area. Run: npm run test:security  (needs `npm run dev` on BASE_URL, default :3000)
 *
 * Uses the REAL Supabase project: creates temporary users with the secret key (auth-admin operations only),
 * signs them in like a browser would, checks what they can and can't do, then deletes them.
 * Nothing is printed from .env.local.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { decideAdminAccess, ADMIN_IDLE_MS } from "../src/lib/admin/access.ts";

process.loadEnvFile(new URL("../.env.local", import.meta.url));
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const created = [];
async function makeUser(prefix) {
  const username = `${prefix}_${randomBytes(3).toString("hex")}`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@users.unitysocialrem.app`,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw error;
  created.push(data.user.id);
  return { id: data.user.id, username, password };
}

/** A logged-in session like the browser has: a supabase client + the cookies to send to the site. */
async function signIn(u) {
  const jar = new Map();
  const sb = createServerClient(URL_, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { error } = await sb.auth.signInWithPassword({ email: `${u.username}@users.unitysocialrem.app`, password: u.password });
  if (error) throw error;
  return { sb, cookie: () => [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ") };
}

/** RFC 6238 TOTP (what an authenticator app computes). */
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const getAdminPage = (cookie) => fetch(`${BASE}/admin`, { headers: cookie ? { cookie } : {}, redirect: "manual" });

after(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

/* ------------------------------------------------------------------ 1. access rule */

describe("access decision (shared by the proxy and the admin layout)", () => {
  const now = Date.now();
  test("no session or not an admin → 404", () => {
    assert.equal(decideAdminAccess({ hasUser: false, isAdminRole: false, aal: null, lastActive: null, now }), "not_found");
    assert.equal(decideAdminAccess({ hasUser: true, isAdminRole: false, aal: "aal2", lastActive: null, now }), "not_found");
  });
  test("admin without 2FA (AAL1) → only the 2FA screen", () => {
    assert.equal(decideAdminAccess({ hasUser: true, isAdminRole: true, aal: "aal1", lastActive: null, now }), "mfa");
  });
  test("admin with AAL2 → ok; idle > 30 min → signed out", () => {
    assert.equal(decideAdminAccess({ hasUser: true, isAdminRole: true, aal: "aal2", lastActive: now - 60_000, now }), "ok");
    assert.equal(decideAdminAccess({ hasUser: true, isAdminRole: true, aal: "aal2", lastActive: now - ADMIN_IDLE_MS - 1000, now }), "expired");
  });
});

/* ------------------------------------------------------------------ 2. a student */

describe("a student", () => {
  let s;
  let student;
  before(async () => {
    student = await makeUser("sec_student");
    s = await signIn(student);
  });

  test("is not admin (role, is_admin)", async () => {
    assert.equal((await s.sb.rpc("has_admin_role")).data, false);
    assert.equal((await s.sb.rpc("is_admin")).data, false);
  });

  test("cannot change their own role", async () => {
    const upd = await s.sb.from("profiles_private").update({ role: "admin" }).eq("id", student.id).select();
    assert.ok(upd.error || (upd.data ?? []).length === 0, "update must be refused");
    const ins = await s.sb.from("profiles_private").insert({ id: student.id, role: "admin" });
    assert.ok(ins.error, "insert must be refused");
    const { data } = await admin.from("profiles_private").select("role").eq("id", student.id).single();
    assert.equal(data.role, "student");
  });

  test("cannot rename themselves or set their own AI limit", async () => {
    const r = await s.sb.from("profiles").update({ username: "hacker_name" }).eq("id", student.id).select();
    assert.ok(r.error || (r.data ?? []).length === 0);
    const l = await s.sb.from("profiles_private").update({ ai_daily_limit: 1000 }).eq("id", student.id).select();
    assert.ok(l.error || (l.data ?? []).length === 0);
  });

  test("every admin database function fails", async () => {
    const calls = [
      ["admin_users", {}],
      ["admin_stats", { p_days: 7 }],
      ["admin_ai_stats", { p_days: 7 }],
      ["admin_question_stats", {}],
      ["admin_lesson_quiz_stats", {}],
      ["admin_system_stats", {}],
      ["admin_lesson_snapshot", { p_lesson_id: "2a774fa0-6e3b-4d4f-8255-b4e2b763c7d8" }],
      ["admin_save_lesson", { p_lesson_id: "2a774fa0-6e3b-4d4f-8255-b4e2b763c7d8", p_data: {}, p_note: "x" }],
      ["admin_reorder", { p_kind: "subjects", p_ids: [] }],
      ["admin_revoke_sessions", { p_user: student.id }],
      ["log_admin_action", { p_action: "x", p_target_type: null, p_target_id: null, p_before: null, p_after: null }],
    ];
    for (const [fn, args] of calls) {
      const { error } = await s.sb.rpc(fn, args);
      assert.ok(error, `${fn} must fail for a student`);
    }
  });

  test("admin tables read as empty", async () => {
    for (const t of ["admin_audit_log", "events", "ai_moderation_log", "lesson_drafts", "lesson_versions", "ai_prompt_versions"]) {
      const { data, error } = await s.sb.from(t).select("*").limit(5);
      assert.ok(error || data.length === 0, `${t} must not be readable`);
    }
    const ai = await s.sb.from("app_settings").select("key").eq("key", "ai");
    assert.equal((ai.data ?? []).length, 0, "private AI settings must be hidden");
    const others = await s.sb.from("profiles_private").select("id").neq("id", student.id);
    assert.equal((others.data ?? []).length, 0, "other users' roles must be hidden");
  });

  test("admin writes are refused (settings, content, announcements, schedule, storage)", async () => {
    const set = await s.sb.from("app_settings").update({ value: { enabled: true } }).eq("key", "maintenance").select();
    assert.ok(set.error || (set.data ?? []).length === 0);
    const les = await s.sb.from("lessons").update({ title_en: "hacked" }).eq("code", "1.1.4").select();
    assert.ok(les.error || (les.data ?? []).length === 0);
    const ann = await s.sb.from("announcements").insert({ title_en: "hacked" });
    assert.ok(ann.error);
    const up = await s.sb.storage.from("media").upload(`test/${Date.now()}.png`, new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), { contentType: "image/png" });
    assert.ok(up.error, "storage upload must be refused");
  });

  test("/admin is a 404 for visitors and students (HTTP)", async () => {
    assert.equal((await getAdminPage(null)).status, 404);
    assert.equal((await getAdminPage(s.cookie())).status, 404);
    const sub = await fetch(`${BASE}/admin/users`, { headers: { cookie: s.cookie() }, redirect: "manual" });
    assert.equal(sub.status, 404);
  });
});

/* ------------------------------------------------------------------ 3. an admin: 2FA required */

describe("an admin", () => {
  let a;
  let user;
  before(async () => {
    user = await makeUser("sec_admin");
    // Make them admin the way a migration does (service role: no auth.uid()).
    const { error } = await admin.from("profiles_private").update({ role: "admin" }).eq("id", user.id);
    if (error) throw error;
    a = await signIn(user);
  });

  test("without 2FA (AAL1): no admin data, only the 2FA screen", async () => {
    assert.equal((await a.sb.rpc("has_admin_role")).data, true);
    assert.equal((await a.sb.rpc("is_admin")).data, false);
    assert.ok((await a.sb.rpc("admin_users")).error, "admin_users must need AAL2");
    const res = await getAdminPage(a.cookie());
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /two-step verification/i);
    assert.doesNotMatch(html, /Recent activity/);
  });

  test("with TOTP 2FA (AAL2): admin works, but still can't change their own role", async () => {
    const en = await a.sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "test" });
    assert.ifError(en.error);
    const v = await a.sb.auth.mfa.challengeAndVerify({ factorId: en.data.id, code: totp(en.data.totp.secret) });
    assert.ifError(v.error);
    assert.equal((await a.sb.rpc("is_admin")).data, true);
    const users = await a.sb.rpc("admin_users");
    assert.ifError(users.error);
    assert.ok(users.data.length >= 1);

    // Every dashboard function works for a verified admin (catches SQL mistakes too).
    for (const [fn, args] of [
      ["admin_stats", { p_days: 30 }],
      ["admin_ai_stats", { p_days: 30 }],
      ["admin_question_stats", {}],
      ["admin_lesson_quiz_stats", {}],
      ["admin_system_stats", {}],
      ["admin_lesson_snapshot", { p_lesson_id: "2a774fa0-6e3b-4d4f-8255-b4e2b763c7d8" }],
    ]) {
      const r = await a.sb.rpc(fn, args);
      assert.ifError(r.error && new Error(`${fn}: ${r.error.message}`));
    }

    const self = await a.sb.from("profiles_private").update({ role: "student" }).eq("id", user.id).select();
    assert.ok(self.error, "an admin must not change their own role");

    const audit = await a.sb
      .from("admin_audit_log")
      .select("id, admin_id, admin_username, action, target_type, target_id, before, after, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    assert.ifError(audit.error && new Error(`audit select: ${audit.error.message}`));

    // Every admin page renders for a verified admin (smoke test).
    for (const path of ["/admin", "/admin/users", `/admin/users/${user.id}`, "/admin/content", "/admin/content/lessons/2a774fa0-6e3b-4d4f-8255-b4e2b763c7d8", "/admin/quizzes", "/admin/ai", "/admin/schedule", "/admin/announcements", "/admin/settings", "/admin/system", "/admin/audit"]) {
      const res = await fetch(`${BASE}${path}`, { headers: { cookie: a.cookie() }, redirect: "manual" });
      const html = await res.text();
      assert.equal(res.status, 200, `${path} → ${res.status}`);
      assert.doesNotMatch(html, /two-step verification/i, `${path} should not ask for 2FA again`);
      assert.doesNotMatch(html, /Application error|Could not load/i, `${path} failed to render`);
      assert.match(res.headers.get("x-robots-tag") ?? "", /noindex/, `${path} must be noindex`);
      const expect = { "/admin": /Recent activity/, "/admin/users": /accounts/, "/admin/ai": /System prompt/, "/admin/audit": /append-only/i }[path];
      if (expect) assert.match(html, expect, `${path} content missing`);
    }

    // The audit log is append-only, even for admins.
    const logged = await a.sb.rpc("log_admin_action", { p_action: "test.ping", p_target_type: null, p_target_id: null, p_before: null, p_after: null });
    assert.ifError(logged.error);
    const del = await a.sb.from("admin_audit_log").delete().eq("id", logged.data).select();
    assert.ok(del.error || (del.data ?? []).length === 0, "audit rows must not be deletable");
    const edit = await a.sb.from("admin_audit_log").update({ action: "edited" }).eq("id", logged.data).select();
    assert.ok(edit.error || (edit.data ?? []).length === 0, "audit rows must not be editable");
  });
});
