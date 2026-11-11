/**
 * LIVE tests for the Answer Paper (handwriting) route and the math homework/quiz data.
 * Run: npm run test:ink  (needs `npm run dev`). Uses the real Supabase project and makes a few real
 * OpenAI calls (low-detail images, ≈ $0.0001 each). A temporary student is created and deleted.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

process.loadEnvFile(new URL("../.env.local", import.meta.url));
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let user, sb, cookie;

before(async () => {
  const username = `ink_${randomBytes(3).toString("hex")}`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email: `${username}@users.unitysocialrem.app`, password, email_confirm: true, user_metadata: { username } });
  if (error) throw error;
  user = data.user;
  const jar = new Map();
  sb = createServerClient(URL_, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) },
  });
  const r = await sb.auth.signInWithPassword({ email: `${username}@users.unitysocialrem.app`, password });
  if (r.error) throw r.error;
  cookie = [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
});

after(async () => {
  if (user) await admin.auth.admin.deleteUser(user.id);
});

/** A "handwritten" answer: text in a handwriting font, black on white, like the exported ink. */
async function handwriting(text, size = 46) {
  const w = 40 + text.length * size * 0.62;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${size * 2}"><rect width="100%" height="100%" fill="#fff"/><text x="20" y="${size * 1.3}" font-family="Segoe Print, Comic Sans MS, cursive" font-size="${size}" fill="#000">${text}</text></svg>`;
  return (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

const post = (body, withCookie = true) =>
  fetch(`${BASE}/api/handwriting`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(withCookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

test("logged out → 401 (typing fallback)", async () => {
  const r = await post({ mode: "read", image: await handwriting("{1, 2}"), expect: "set" }, false);
  assert.equal(r.status, 401);
});

test("oversized or fake images are rejected on the server", async () => {
  assert.equal((await post({ mode: "read", image: Buffer.alloc(230_000, 7).toString("base64"), expect: "set" })).status, 413);
  assert.equal((await post({ mode: "read", image: Buffer.from("not an image at all").toString("base64"), expect: "set" })).status, 400);
});

test("reads a handwritten set; the same image is served from the cache", async () => {
  // A different set every run, so the server cache from an earlier run is not hit.
  const RUN = Date.now() % 1000; // unique per run: the server cache must never serve an earlier run
  const els = [String(100 + (RUN % 90)), String(200 + (RUN % 70)), String(300 + (RUN % 50))];
  const image = await handwriting(`{${els.join(", ")}}`);
  const t0 = Date.now();
  const r = await post({ mode: "read", image, expect: "set" });
  const body = await r.json();
  assert.equal(r.status, 200, JSON.stringify(body));
  console.log(`    read in ${Date.now() - t0} ms:`, JSON.stringify(body.result));
  assert.equal(body.result.type, "set");
  assert.deepEqual([...body.result.elements].sort(), [...els].sort());
  const again = await (await post({ mode: "read", image, expect: "set" })).json();
  assert.equal(again.cached, true);
});

test("reads a number (and never grades it)", async () => {
  const n = -(1000 + (Date.now() % 9000));
  const body = await (await post({ mode: "read", image: await handwriting(String(n)), expect: "number" })).json();
  console.log("    number:", JSON.stringify(body.result));
  assert.equal(body.result.value, n);
  assert.equal("correct" in body, false);
});

/** A worksheet image: printed labels on the left, "handwritten" answers on each line. */
async function worksheet(lines) {
  const rowH = 72;
  const rows = lines
    .map(([label, ans], i) => {
      const y = 12 + (i + 1) * rowH - 22;
      return `<text x="140" y="${y}" text-anchor="end" font-family="Cambria Math, serif" font-size="20" font-weight="600">${label} =</text><line x1="150" y1="${y + 4}" x2="560" y2="${y + 4}" stroke="#9ab" /><text x="165" y="${y}" font-family="Segoe Print, Comic Sans MS, cursive" font-size="30">${ans}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="580" height="${24 + lines.length * rowH}"><rect width="100%" height="100%" fill="#fff"/>${rows}</svg>`;
  return (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

test("worksheet: ONE call reads every labelled line (one result per label)", async () => {
  await new Promise((r) => setTimeout(r, 10_500)); // stay under the per-IP burst limit (6 per 10 s)
  const k = 10 + (Date.now() % 80);
  const lines = [
    ["A ∪ B", `{1, 2, ${k + 10}}`],
    ["A ∩ B", "∅"],
    ["n(A)", String(k + 20)],
  ];
  const t0 = Date.now();
  const r = await post({ mode: "read", image: await worksheet(lines), labels: lines.map((l) => l[0]), expects: ["set", "set", "number"] });
  const body = await r.json();
  assert.equal(r.status, 200, JSON.stringify(body));
  console.log(`    worksheet in ${Date.now() - t0} ms:`, JSON.stringify(body.result));
  assert.equal(body.result.length, 3);
  assert.deepEqual([...body.result[0].elements].sort(), ["1", "2", String(k + 10)].sort());
  assert.deepEqual(body.result[1].elements, []);
  assert.equal(body.result[2].value, k + 20);
});

test("usage is counted (checks, tokens) for the cost chart and budget", async () => {
  const { data: st } = await sb.rpc("my_ink_status");
  assert.equal(st.available, true);
  assert.equal(st.checks, 3, "cached reads are not counted again");
  assert.equal(st.limit, 60);
  const { data: row } = await admin.from("ai_usage").select("ink_checks, ink_hints, ink_token_calls, input_tokens, output_tokens").eq("user_id", user.id).single();
  console.log("    tokens:", JSON.stringify(row));
  assert.equal(row.ink_token_calls, 3);
  assert.ok(row.input_tokens > 0 && row.output_tokens > 0);
});

test("homework progress: students can save only their own row", async () => {
  const { data: lesson } = await sb.from("lessons").select("id").eq("slug", "1-1").limit(1).single();
  const up = await sb.from("homework_progress").upsert({ lesson_id: lesson.id, done: ["hw1", "hw3"], answers: { "hw3:0": { input: "{1}", correct: true } } }, { onConflict: "user_id,lesson_id" });
  assert.equal(up.error, null);
  const { data } = await sb.from("homework_progress").select("done").eq("lesson_id", lesson.id).single();
  assert.deepEqual(data.done, ["hw1", "hw3"]);
  const other = await sb.from("homework_progress").insert({ user_id: "00000000-0000-0000-0000-000000000000", lesson_id: lesson.id });
  assert.notEqual(other.error, null);
});

test("quiz: set / number / venn answers are scored in SQL", async () => {
  const { data: lesson } = await sb.from("lessons").select("id, quizzes(id)").eq("slug", "1-1").limit(1).single();
  const { data: qs } = await sb.from("quiz_questions").select("id, kind, answer, correct_index").eq("quiz_id", lesson.quizzes[0]?.id ?? lesson.quizzes.id);
  const answers = qs.map((q) =>
    q.kind === "choice"
      ? { question_id: q.id, chosen: q.correct_index }
      : q.kind === "venn"
        ? { question_id: q.id, value: [...q.answer.regions].reverse() }
        : { question_id: q.id, value: q.kind === "set" ? [...q.answer.value].reverse() : q.answer.value },
  );
  const { data, error } = await sb.rpc("record_quiz_attempt", { p_lesson_id: lesson.id, p_answers: answers, p_duration_ms: 1000 });
  assert.equal(error, null);
  assert.equal(data.score, qs.length);
  const kinds = new Set(qs.map((q) => q.kind));
  assert.ok(kinds.has("set") && kinds.has("number") && kinds.has("venn"));
});
