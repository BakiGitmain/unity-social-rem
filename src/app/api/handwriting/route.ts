import { createHash } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import { generateText, jsonSchema, Output } from "ai";
import { createClient } from "@/lib/supabase/server";
import { burstLimited } from "@/lib/tutor/burst";
import { checkImage } from "@/lib/ink/image";
import { parseParts, parseRecognition, RECOGNITION_PARTS_SCHEMA, RECOGNITION_SCHEMA, UNREADABLE, type Recognition } from "@/lib/ink/recognition";

/**
 * Answer Paper: the AI READS a handwritten answer (one line, or a whole worksheet of labelled lines in ONE
 * call). Only called when the student taps Check. The calculation paper is never sent here. Never grades: grading is
 * done in the browser by our own set/number checkers. Images are never logged or stored.
 * Order: burst limit → login → image check → cache → start_ink_check (switch, budget, daily limit) → AI → tokens.
 */
export const maxDuration = 30;

type Body = {
  mode?: "read";
  image?: string;
  expect?: "set" | "number";
  /** Worksheet: the printed labels (one per line) and what each line should contain. */
  labels?: string[];
  expects?: ("set" | "number")[];
};

const json = (status: number, body: object) => Response.json(body, { status });

/** Small in-memory cache (per server instance): the same image + expected type → no second AI call. */
const CACHE = new Map<string, Recognition | Recognition[]>();
function remember(key: string, r: Recognition | Recognition[]) {
  CACHE.set(key, r);
  if (CACHE.size > 500) CACHE.delete(CACHE.keys().next().value!);
}

const READ_PROMPT = (expect: "set" | "number") => `You read a student's handwritten math answer from an image.
The answer is expected to be ${expect === "set" ? "A SET, e.g. {1, 2, 3} or ∅ (the empty set, also written { })" : "A NUMBER, e.g. 12, -4, 3/4 or 2.5"}.
Transcribe EXACTLY what is written, even if it looks wrong or incomplete. Never solve, fix or complete it.
- latex: what is written, as LaTeX.
- type: "set", "number", "expression", or "unreadable" if you cannot read it.
- elements: for a set, each element as written (["-1","0","1"]); [] for ∅ or { }; else null.
- value: for a number, its value; else null.
- confidence: 0-1, how sure you are of every character.`;

const PARTS_PROMPT = (labels: string[], expects: ("set" | "number")[]) => `You read a student's handwritten math worksheet from an image.
Each line starts with a PRINTED label followed by "=", then the student's handwritten answer for that label.
The lines are, from top to bottom:
${labels.map((l, i) => `${i + 1}. "${l}" → expected: ${expects[i] === "number" ? "a number" : "a set (or ∅)"}`).join("\n")}
For EACH label, transcribe EXACTLY what is written on its line, even if it looks wrong or incomplete. Never solve, fix or complete it.
Return one item per label, in the same order, with the label copied exactly. An empty line → type "unreadable", confidence 0.
- latex: what is written, as LaTeX. type: "set", "number", "expression" or "unreadable".
- elements: for a set, each element as written; [] for ∅ or { }; else null. value: for a number, its value; else null.
- confidence: 0-1, how sure you are of every character on that line.`;

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || req.headers.get("x-real-ip") || "local";
  if (burstLimited(`ink:${ip}`, 6, 10_000)) return json(429, { error: "too_fast" });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: "bad_request" });
  }
  if (body.mode && body.mode !== "read") return json(400, { error: "bad_request" });
  const mode = "read" as const;
  const expect = body.expect === "number" ? "number" : "set";
  const labels = Array.isArray(body.labels) ? body.labels.slice(0, 10).map((l) => String(l).slice(0, 40)) : [];
  const expects = labels.map((_, i) => (body.expects?.[i] === "number" ? "number" : "set")) as ("set" | "number")[];

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return json(401, { error: "login_required" });

  const img = checkImage(body.image);
  if (!img.ok) return json(img.error === "too_big" ? 413 : 400, { error: img.error });

  const key = createHash("sha256").update(img.bytes).update(`|${mode}|${expect}|${labels.join("")}|${expects.join(",")}`).digest("hex");
  if (mode === "read") {
    const hit = CACHE.get(key);
    if (hit) return json(200, { result: hit, cached: true });
  }

  const { data: start, error } = await supabase.rpc("start_ink_check", { p_kind: mode });
  const s = start as { allowed: boolean; reason?: string; used?: number; limit?: number; model?: string | null; chat_model?: string | null } | null;
  if (error || !s) return json(500, { error: "usage_error" });
  if (!s.allowed) return json(403, { error: s.reason ?? "off", used: s.used, limit: s.limit });

  const model = openai(s.model || process.env.OPENAI_VISION_MODEL || s.chat_model || process.env.OPENAI_MODEL || "gpt-6-luna");
  const image = {
    type: "file" as const,
    mediaType: img.mediaType,
    data: img.bytes,
    providerOptions: { openai: { imageDetail: "low" } },
  };
  const providerOptions = {
    openai: { store: false, reasoningEffort: "none", safetyIdentifier: createHash("sha256").update(userId).digest("hex").slice(0, 32) },
  };

  try {
    if (mode === "read" && labels.length) {
      const r = await generateText({
        model,
        temperature: 0,
        maxOutputTokens: Math.min(1200, 120 + labels.length * 110),
        output: Output.object({ schema: jsonSchema(RECOGNITION_PARTS_SCHEMA as never) }),
        messages: [{ role: "user", content: [{ type: "text", text: PARTS_PROMPT(labels, expects) }, image] }],
        providerOptions,
        abortSignal: AbortSignal.timeout(25_000),
      });
      await recordTokens(supabase, r.totalUsage);
      const result = parseParts(r.output, labels) ?? labels.map(() => UNREADABLE);
      if (result.some((x) => x.type !== "unreadable")) remember(key, result);
      return json(200, { result, cached: false, used: s.used, limit: s.limit });
    }

    {
      const r = await generateText({
        model,
        temperature: 0,
        maxOutputTokens: 300,
        output: Output.object({ schema: jsonSchema<Recognition>(RECOGNITION_SCHEMA as never) }),
        messages: [{ role: "user", content: [{ type: "text", text: READ_PROMPT(expect) }, image] }],
        providerOptions,
        abortSignal: AbortSignal.timeout(20_000),
      });
      await recordTokens(supabase, r.totalUsage);
      const result = parseRecognition(r.output) ?? UNREADABLE;
      if (result.type !== "unreadable") remember(key, result);
      return json(200, { result, cached: false, used: s.used, limit: s.limit });
    }

  } catch {
    return json(502, { error: "ai_error" });
  }
}

async function recordTokens(supabase: Awaited<ReturnType<typeof createClient>>, usage: unknown) {
  const u = (usage ?? {}) as { inputTokens?: number; outputTokens?: number; inputTokenDetails?: { cacheReadTokens?: number } };
  await supabase.rpc("record_ink_tokens", {
    p_input: u.inputTokens ?? 0,
    p_cached: u.inputTokenDetails?.cacheReadTokens ?? 0,
    p_output: u.outputTokens ?? 0,
  });
}
