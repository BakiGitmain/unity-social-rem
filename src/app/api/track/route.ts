import { createClient } from "@/lib/supabase/server";
import { burstLimited } from "@/lib/tutor/burst";

/**
 * First-party activity tracking (no third-party trackers). The browser posts here; this SERVER code calls
 * the database functions as the signed-in user (or anonymously), which always record auth.uid() itself.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIMPLE = new Set(["lesson_view", "lesson_complete", "quiz_start"]);

type Body = {
  type?: string;
  lessonId?: string;
  answers?: { question_id?: string; chosen?: number | null; value?: unknown }[];
  durationMs?: number;
};

/** Typed answers: a finite number, or a short list of short strings (set elements / Venn regions). */
function cleanValue(v: unknown): number | string[] | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (Array.isArray(v) && v.length <= 60 && v.every((x) => typeof x === "string" && x.length <= 40)) return v as string[];
  return null;
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "local";
  if (burstLimited(`track:${ip}`, 20, 10_000)) return new Response(null, { status: 429 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(null, { status: 400 });
  }
  const lessonId = body.lessonId && UUID.test(body.lessonId) ? body.lessonId : null;
  const supabase = await createClient();

  if (body.type === "seen") {
    await supabase.rpc("touch_last_seen");
  } else if (body.type && SIMPLE.has(body.type)) {
    await supabase.rpc("track_event", { p_type: body.type, p_lesson_id: lessonId, p_metadata: {} });
  } else if (body.type === "quiz_attempt" && lessonId && Array.isArray(body.answers)) {
    const answers = body.answers
      .slice(0, 100)
      .filter((a) => typeof a.question_id === "string" && UUID.test(a.question_id))
      .map((a) => ({ question_id: a.question_id, chosen: Number.isInteger(a.chosen) ? a.chosen : null, value: cleanValue(a.value) }));
    await supabase.rpc("record_quiz_attempt", {
      p_lesson_id: lessonId,
      p_answers: answers,
      p_duration_ms: Number.isFinite(body.durationMs) ? Math.round(body.durationMs!) : null,
    });
  } else {
    return new Response(null, { status: 400 });
  }
  return new Response(null, { status: 204 });
}
