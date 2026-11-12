import { createHash } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import { generateText, jsonSchema, Output } from "ai";
import { createClient } from "@/lib/supabase/server";
import { getTutorLesson } from "@/lib/data";
import { buildContext } from "@/lib/tutor/prompt";
import { burstLimited } from "@/lib/tutor/burst";

/**
 * Optional AI on a notes board (login required; uses Rem's limits, budget and cost tracking via start_ai_message):
 *  - summary:    a short summary of the board (added as a new card by the browser)
 *  - flashcards: 2–5 question/answer flashcards from ONE card (the student chooses which to keep)
 *  - check:      gentle, short notes on factual mistakes compared with the lesson
 * The AI never changes the student's notes: it only returns text; the student decides what to add.
 */
export const maxDuration = 30;

type Body = { mode?: "summary" | "flashcards" | "check"; lessonId?: string; text?: string; locale?: "en" | "am" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: object) => Response.json(body, { status });

const PROMPTS = {
  summary:
    "Summarise the student's study notes below in 3–5 short bullet points (Markdown '- '). Use the lesson's terms. Only summarise what is in the notes; do not add new topics.",
  check:
    "Gently check the student's notes against the LESSON CONTEXT. List at most 3 factual mistakes or missing key ideas as short bullet points ('- '), each with the correct fact from the lesson. If everything is correct, say so in one friendly sentence. Never rewrite the notes.",
  flashcards:
    "Make 2–5 flashcards from the student's card below: a short question on the front, a short answer (max 25 words) on the back. Use only facts from the card and the lesson.",
} as const;

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "local";
  if (burstLimited(`notes-ai:${ip}`, 5, 10_000)) return json(429, { error: "too_fast" });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: "bad_request" });
  }
  const mode = body.mode === "flashcards" || body.mode === "check" ? body.mode : "summary";
  const text = String(body.text ?? "").trim().slice(0, 6000);
  if (!body.lessonId || !UUID.test(body.lessonId) || text.length < 3) return json(400, { error: "bad_request" });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return json(401, { error: "login_required" });

  const [start, lesson] = await Promise.all([supabase.rpc("start_ai_message", { p_lesson_id: body.lessonId }), getTutorLesson(body.lessonId)]);
  const s = start.data as { allowed: boolean; reason?: string; model?: string | null } | null;
  if (start.error || !s) return json(500, { error: "usage_error" });
  if (!s.allowed) return json(403, { error: s.reason ?? "off" });
  if (!lesson) return json(404, { error: "lesson_not_found" });

  const lang = body.locale === "am" ? "Reply in simple Amharic." : "Reply in simple English.";
  const instructions = `You help an Ethiopian secondary student with their study notes. ${PROMPTS[mode]} ${lang}\n\n${buildContext(lesson, "all", 0)}`;
  const model = openai(s.model || process.env.OPENAI_MODEL || "gpt-6-luna");
  const providerOptions = {
    openai: { store: false, reasoningEffort: "none", safetyIdentifier: createHash("sha256").update(userId).digest("hex").slice(0, 32) },
  };
  try {
    if (mode === "flashcards") {
      const r = await generateText({
        model,
        instructions,
        prompt: `CARD:\n${text}`,
        maxOutputTokens: 500,
        output: Output.object({
          schema: jsonSchema<{ cards: { front: string; back: string }[] }>({
            type: "object",
            properties: {
              cards: {
                type: "array",
                items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" } }, required: ["front", "back"], additionalProperties: false },
              },
            },
            required: ["cards"],
            additionalProperties: false,
          }),
        }),
        providerOptions,
        abortSignal: AbortSignal.timeout(25_000),
      });
      await record(supabase, r.totalUsage);
      const cards = (r.output?.cards ?? [])
        .filter((c) => typeof c.front === "string" && typeof c.back === "string" && c.front.trim())
        .slice(0, 5)
        .map((c) => ({ front: c.front.trim().slice(0, 300), back: c.back.trim().slice(0, 600) }));
      return json(200, { cards });
    }
    const r = await generateText({ model, instructions, prompt: `STUDENT NOTES:\n${text}`, maxOutputTokens: 400, providerOptions, abortSignal: AbortSignal.timeout(25_000) });
    await record(supabase, r.totalUsage);
    return json(200, { text: r.text.trim().slice(0, 3000) });
  } catch {
    return json(502, { error: "ai_error" });
  }
}

async function record(supabase: Awaited<ReturnType<typeof createClient>>, usage: unknown) {
  const u = (usage ?? {}) as { inputTokens?: number; outputTokens?: number; inputTokenDetails?: { cacheReadTokens?: number } };
  await supabase.rpc("record_ai_tokens", { p_input: u.inputTokens ?? 0, p_cached: u.inputTokenDetails?.cacheReadTokens ?? 0, p_output: u.outputTokens ?? 0, p_searches: 0 });
}
