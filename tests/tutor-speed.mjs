/**
 * Rem speed check. Run: npm run test:tutor-speed  (needs `npm run dev`, or BASE_URL=https://… for production)
 *
 * Creates a temporary student, asks Rem a few short questions and prints, per request:
 *   time to first token (TTFT) and total time, as the student's browser sees it.
 * Also times the pieces on their own (moderation, start_ai_message RPC, the model alone) to find the bottleneck.
 * The temporary user (and its AI usage / chats) is deleted afterwards. Nothing is printed from .env.local.
 * Each run costs a few AI questions (~$0.001). LANG_Q=am asks in Amharic (longer answers), RUNS=n sets the count.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

process.loadEnvFile(new URL("../.env.local", import.meta.url));
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RUNS = Number(process.env.RUNS ?? 4);
const service = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const ms = (t0) => Math.round(performance.now() - t0);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const username = `speed_${randomBytes(3).toString("hex")}`;
const password = randomBytes(12).toString("base64url");
const { data: created, error } = await service.auth.admin.createUser({
  email: `${username}@users.unitysocialrem.app`,
  password,
  email_confirm: true,
  user_metadata: { username },
});
if (error) throw error;
const userId = created.user.id;

try {
  const jar = new Map();
  const sb = createServerClient(URL_, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { error: e2 } = await sb.auth.signInWithPassword({ email: `${username}@users.unitysocialrem.app`, password });
  if (e2) throw e2;
  const cookie = [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");

  const { data: lesson } = await service.from("lessons").select("id, title_en").eq("status", "published").limit(1).single();
  console.log(`Lesson: ${lesson.title_en} · ${BASE}\n`);

  const questions =
    process.env.LANG_Q === "am"
      ? ["የዚህ ክፍል ዋና ሀሳብ ምንድን ነው?", "ቀላል ምሳሌ ስጠኝ።", "ይህ ለምን አስፈላጊ ነው?", "በአንድ ዓረፍተ ነገር አስረዳኝ።"]
      : ["What is the main idea of this part?", "Give me a simple example.", "Why is this important?", "Explain it in one sentence."];

  /* 1) the whole thing, as the browser sees it */
  const rows = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/tutor`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        lessonId: lesson.id,
        view: "learn",
        part: 0,
        locale: process.env.LANG_Q === "am" ? "am" : "en",
        messages: [{ id: `m${i}`, role: "user", parts: [{ type: "text", text: questions[i % questions.length] }] }],
      }),
    });
    const headers = ms(t0);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    let ttft = null,
      text = "";
    const dec = new TextDecoder();
    for await (const chunk of res.body) {
      for (const line of dec.decode(chunk, { stream: true }).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === "text-delta") {
            ttft ??= ms(t0);
            text += ev.delta;
          }
        } catch {}
      }
    }
    rows.push({ run: i + 1, headers_ms: headers, ttft_ms: ttft, total_ms: ms(t0), chars: text.length });
    await new Promise((r) => setTimeout(r, 2100)); // stay under the burst limit (5 / 10 s)
  }
  console.table(rows);
  const warm = rows.slice(1);
  console.log(`Warm median: TTFT ${median(warm.map((r) => r.ttft_ms))} ms · total ${median(warm.map((r) => r.total_ms))} ms\n`);

  /* 2) the pieces on their own */
  const piece = async (name, fn) => {
    const xs = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await fn();
      xs.push(ms(t0));
    }
    return { piece: name, median_ms: median(xs), runs: xs.join(" / ") };
  };
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-6-luna";
  const pieces = [
    await piece("moderation (OpenAI)", () =>
      fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "omni-moderation-latest", input: "What is the main idea of this part?" }),
      }).then((r) => r.json()),
    ),
    await piece("my_ai_status RPC (Supabase round trip)", () => sb.rpc("my_ai_status")),
    await piece(`model alone: first token (${model})`, async () => {
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, input: "Say hello in five words.", stream: true, store: false, max_output_tokens: 40, reasoning: { effort: "none" } }),
      });
      for await (const c of r.body) if (new TextDecoder().decode(c).includes("output_text.delta")) break;
    }),
  ];
  console.table(pieces);
} finally {
  await service.from("ai_usage").delete().eq("user_id", userId);
  await service.from("ai_chats").delete().eq("user_id", userId);
  await service.auth.admin.deleteUser(userId);
  console.log("temporary user deleted");
}
