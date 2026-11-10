import { createHash } from "node:crypto";
import { after } from "next/server";
import { openai } from "@ai-sdk/openai";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  jsonSchema,
  smoothStream,
  streamText,
  tool,
  toUIMessageStream,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { createClient } from "@/lib/supabase/server";
import { getTutorLesson } from "@/lib/data";
import { SYSTEM_PROMPT, buildContext } from "@/lib/tutor/prompt";
import { burstLimited } from "@/lib/tutor/burst";
import {
  FOLLOWUPS_MARK,
  QUIZ_TOOL,
  TUTOR,
  type TutorIntent,
  type TutorMessageMeta,
  type TutorQuiz,
  type TutorView,
} from "@/lib/tutor/config";

/**
 * AI study tutor "Rem". Streams answers from OpenAI (key stays on the server).
 * Order: burst limit → login → daily limit + moderation → stream.
 */
export const maxDuration = 30;

type Body = {
  messages?: UIMessage[];
  lessonId?: string;
  view?: TutorView;
  part?: number;
  intent?: TutorIntent;
  locale?: "en" | "am";
  /** The paragraph around text selected for "Explain further" (not shown in the chat). */
  selectionContext?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MSG = {
  limit: {
    en: "You've used all your questions for today 🌙 They reset tomorrow (Addis Ababa time). Keep revising with the notes and the quiz!",
    am: "ለዛሬ ያሉዎትን ጥያቄዎች በሙሉ ተጠቅመዋል 🌙 ነገ (በአዲስ አበባ ሰዓት) ይታደሳሉ። በማስታወሻዎቹና በፈተናው ክለሳዎን ይቀጥሉ!",
  },
  flagged: {
    en: "I can't help with that one 🙏 I'm here for school and studying. Ask me anything about this lesson!",
    am: "በዚያ ጉዳይ መርዳት አልችልም 🙏 እኔ ለትምህርትና ለጥናት ነው ያለሁት። ስለዚህ ትምህርት ማንኛውንም ይጠይቁኝ!",
  },
} as const;

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

/** Text of a UI message for the model: text parts only, follow-up line removed, quiz turns summarised. */
function messageText(m: UIMessage): string {
  const out: string[] = [];
  for (const p of m.parts) {
    if (p.type === "text") {
      const i = p.text.lastIndexOf(FOLLOWUPS_MARK);
      out.push((i >= 0 ? p.text.slice(0, i) : p.text).trim());
    } else if (p.type === `tool-${QUIZ_TOOL}` && "input" in p && p.input) {
      const q = p.input as Partial<TutorQuiz>;
      const correct = typeof q.answer === "number" ? q.options?.[q.answer] : undefined;
      out.push(`[I asked a quiz question: "${q.question ?? ""}" Correct answer: "${correct ?? ""}"]`);
    }
  }
  return out.filter(Boolean).join("\n\n");
}

/** OpenAI moderation (free). Fails open: the system prompt still refuses harmful requests. */
async function isFlagged(text: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { results?: { flagged?: boolean }[] };
    return !!data.results?.[0]?.flagged;
  } catch {
    return false;
  }
}

/** A fixed reply streamed like a normal answer (limit reached, moderation). */
function staticReply(text: string, meta: TutorMessageMeta) {
  const stream = createUIMessageStream<UIMessage<TutorMessageMeta>>({
    execute: ({ writer }) => {
      writer.write({ type: "start", messageMetadata: meta });
      writer.write({ type: "text-start", id: "t" });
      writer.write({ type: "text-delta", id: "t", delta: text });
      writer.write({ type: "text-end", id: "t" });
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  // 1) Burst limit per IP.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || req.headers.get("x-real-ip") || "local";
  if (burstLimited(ip)) return json(429, "too_fast");

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, "bad_request");
  }
  const locale = body.locale === "am" ? "am" : "en";
  const view: TutorView = body.view === "all" || body.view === "topics" ? body.view : "learn";
  const part = Number.isInteger(body.part) ? Math.max(0, body.part!) : 0;
  const intent: TutorIntent = body.intent === "quiz" ? "quiz" : "chat";
  if (!body.lessonId || !UUID.test(body.lessonId)) return json(400, "bad_request");
  if (!Array.isArray(body.messages) || !body.messages.length) return json(400, "bad_request");

  // 2) Login required.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return json(401, "login_required");

  // The new student message.
  const history = body.messages.slice(-TUTOR.historyMessages);
  const last = history[history.length - 1]!;
  const question = last.role === "user" ? messageText(last) : "";
  if (!question) return json(400, "bad_request");
  if (question.length > TUTOR.maxInputChars) return json(400, "too_long");

  // 3) Daily limit (counts this message), moderation and the lesson, in parallel.
  const [usage, flagged, lesson] = await Promise.all([
    supabase.rpc("bump_ai_usage", { p_messages: 1, p_searches: 0 }).single<{ messages: number; searches: number }>(),
    isFlagged(question),
    getTutorLesson(body.lessonId),
  ]);
  if (usage.error || !usage.data) return json(500, "usage_error");
  if (!lesson) return json(404, "lesson_not_found");

  const messagesLeft = Math.max(0, TUTOR.dailyMessages - usage.data.messages);
  if (usage.data.messages > TUTOR.dailyMessages) {
    return staticReply(MSG.limit[locale], { messagesLeft: 0, limitReached: true });
  }
  if (flagged) return staticReply(MSG.flagged[locale], { messagesLeft });

  // 4) Model input: short stable system prompt + current part only + last messages (text only).
  const messages: ModelMessage[] = [];
  for (const m of history) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = messageText(m).slice(0, m.role === "user" ? TUTOR.maxInputChars : 3000);
    if (!text) continue;
    if (!messages.length && m.role !== "user") continue; // start with the student
    messages.push({ role: m.role, content: text });
  }
  const extra = typeof body.selectionContext === "string" ? body.selectionContext.slice(0, 800).trim() : "";
  if (extra && messages.length) {
    const lastMsg = messages[messages.length - 1]!;
    lastMsg.content = `${lastMsg.content as string}\n\n(Surrounding paragraph from the notes: "${extra}")`;
  }

  // Amharic question, or asking for Amharic → the answer will be in Amharic.
  const amharicAnswer = /[ሀ-፿]/.test(question) || /amharic/i.test(question);
  const searchAllowed = intent === "chat" && usage.data.searches < TUTOR.dailySearches;
  const quizTool = tool({
    description: "Show the student ONE multiple-choice question about the lesson, as tappable answer buttons.",
    inputSchema: jsonSchema<TutorQuiz>({
      type: "object",
      properties: {
        question: { type: "string", description: "The question, in the student's language." },
        options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4, description: "Exactly 4 short options." },
        answer: { type: "integer", minimum: 0, maximum: 3, description: "0-based index of the correct option." },
        explanation: { type: "string", description: "1-2 sentences: why the answer is correct." },
      },
      required: ["question", "options", "answer", "explanation"],
      additionalProperties: false,
    }),
    execute: async () => ({ shown: true }),
  });

  // Count web searches once the answer is done (kept alive with after()).
  let resolveSearches: (n: number) => void = () => {};
  const searchesDone = new Promise<number>((r) => (resolveSearches = r));
  after(async () => {
    const n = await Promise.race([searchesDone, new Promise<number>((r) => setTimeout(() => r(0), 60_000))]);
    if (n > 0) await supabase.rpc("bump_ai_usage", { p_messages: 0, p_searches: Math.min(n, 5) });
  });

  const result = streamText({
    model: openai(process.env.OPENAI_MODEL || "gpt-6-luna"),
    instructions: `${SYSTEM_PROMPT}\n\n${buildContext(lesson, view, part)}`,
    messages,
    maxOutputTokens: amharicAnswer ? TUTOR.maxOutputTokensAmharic : TUTOR.maxOutputTokens,
    tools: searchAllowed
      ? { [QUIZ_TOOL]: quizTool, web_search: openai.tools.webSearch({ searchContextSize: "low", userLocation: { type: "approximate", country: "ET" } }) }
      : { [QUIZ_TOOL]: quizTool },
    toolChoice: intent === "quiz" ? { type: "tool", toolName: QUIZ_TOOL } : "auto",
    providerOptions: {
      openai: {
        store: false,
        reasoningEffort: "none",
        textVerbosity: "low",
        parallelToolCalls: false,
        maxToolCalls: searchAllowed ? 2 : 1,
        promptCacheKey: "rem-tutor-v1",
        safetyIdentifier: createHash("sha256").update(userId).digest("hex").slice(0, 32),
      },
    },
    experimental_transform: smoothStream({ chunking: "word" }),
    onEnd: (event) => {
      const calls = event.steps.flatMap((s) => s.toolCalls).filter((c) => c.toolName === "web_search").length;
      resolveSearches(calls);
    },
    onError: () => resolveSearches(0),
    onAbort: () => resolveSearches(0),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendSources: true,
      messageMetadata: ({ part: p }): TutorMessageMeta | undefined => (p.type === "start" ? { messagesLeft } : undefined),
      onError: () => (locale === "am" ? "ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።" : "Something went wrong. Please try again."),
    }),
  });
}
