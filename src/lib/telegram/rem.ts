import "server-only";
import { createHash } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import { generateText, type ModelMessage } from "ai";
import { systemPrompt } from "@/lib/tutor/prompt";
import { moderate } from "@/lib/tutor/moderate";
import { FOLLOWUPS_MARK, TUTOR } from "@/lib/tutor/config";
import { localizeTip, mdToTelegramHtml, splitFollowups } from "@/lib/telegram/format";
import type { BotDb, BotState } from "@/lib/telegram/db";
import { extractVenn, stripTextArt, vennHistoryNote, type VennSpec } from "@/lib/telegram/venn";

/** Rem questions per Telegram chat per Addis Ababa day. */
export const TG_REM_DAILY = 15;

/**
 * Appended to Rem's normal system prompt (the same teacher style as the site). Stable text, so prompt caching still
 * works. There is no lesson on screen in Telegram.
 */
const TELEGRAM_RULES = `TELEGRAM CHAT
- The student is chatting with you in Telegram (@UnitySocialRemBot). There is NO lesson on screen: answer from the Ethiopian Grade 9-12 curriculum (Mathematics, English, Geography, History).
- Telegram cannot show tables or LaTeX. Never write a Markdown table: use a short list ("- Union: ...") instead.
- Write math with plain symbols, e.g. A ∪ B, A ∩ B, A ∖ B, ∅, x ∈ A, A ⊆ B, x², √2, {1, 2, 3}. Never use $ or backslashes.
- NEVER draw anything with text characters: no ASCII art, no circles or boxes made of ( ) / \\ | _ - or code blocks. Explain in words instead.
- When a Venn diagram really helps (sets, shading, regions), add ONE line just before the FOLLOWUPS line and the server sends it as a picture:
VENN: {"sets":["A","B"],"shade":"A ∩ B","elements":{"A":[1,2],"AB":[3],"B":[4,5],"none":[6]},"names":{"A":"even numbers","B":"multiples of 3"}}
  "sets": 2 or 3 single capital letters (not U). Region keys = the letters of the circles the region is inside (A, B, C, AB, AC, BC, ABC) or "none" (inside U, outside every circle). "shade", "elements" and "names" are optional; elements are short numbers or words.
  The picture numbers the regions. 2 sets: 1 = first set only, 2 = both, 3 = second set only, 4 = outside both. 3 sets: 1 = first only, 2 = second only, 3 = third only, 4 = first and second only, 5 = first and third only, 6 = second and third only, 7 = all three, 8 = outside all. In your text, point to "region 2" etc.
- Same format as always: **bold** first line with the answer, short numbered steps, "💡 Tip:" last (in Amharic answers write "💡 ጠቃሚ ምክር፡" instead), then the FOLLOWUPS line.`;

type Start = { allowed: boolean; reason?: "off" | "budget" | "limit"; used?: number; limit?: number; model?: string | null; system_prompt?: string | null };

export type RemResult =
  | { kind: "answer"; html: string; followups: string[]; venn: VennSpec | null; used: number; history: NonNullable<BotState["history"]> }
  | { kind: "limit" | "resting" | "flagged" | "error" | "too_long" };

/**
 * Asks Rem. `onCounted(used)` runs as soon as the question is counted (before the model answers), so the bot can show
 * "Asking Rem… (used/15 today)" at once and later edit that message into the answer.
 */
export async function askRem(
  db: BotDb,
  chatId: number,
  question: string,
  history: BotState["history"] = [],
  onCounted?: (used: number) => Promise<void>,
): Promise<RemResult> {
  const q = question.trim();
  if (q.length > TUTOR.maxInputChars) return { kind: "too_long" };

  const moderation = moderate(q);
  const { data, error } = await db.rpc("telegram_start_rem", { p_chat_id: chatId, p_limit: TG_REM_DAILY });
  const s = data as Start | null;
  if (error || !s) return { kind: "error" };
  if (!s.allowed) return { kind: s.reason === "limit" ? "limit" : "resting" };
  const used = Math.min(TG_REM_DAILY, s.used ?? TG_REM_DAILY);

  const messages: ModelMessage[] = [...history.slice(-4).map((m) => ({ role: m.role, content: m.content }) as ModelMessage), { role: "user", content: q }];
  const amharic = /[ሀ-፿]/.test(q) || /amharic/i.test(q);
  const abort = new AbortController();

  const answer = generateText({
    abortSignal: abort.signal,
    model: openai(s.model || process.env.OPENAI_MODEL || "gpt-6-luna"),
    instructions: `${systemPrompt(s.system_prompt)}\n\n${TELEGRAM_RULES}`,
    messages,
    maxOutputTokens: amharic ? TUTOR.maxOutputTokensAmharic : TUTOR.maxOutputTokens,
    providerOptions: {
      openai: {
        store: false,
        reasoningEffort: "none",
        textVerbosity: "low",
        promptCacheKey: "rem-telegram-v2",
        safetyIdentifier: createHash("sha256").update(`tg:${chatId}`).digest("hex").slice(0, 32),
      },
    },
  });
  answer.catch(() => {}); // awaited below; avoid an unhandled rejection if moderation aborts it first
  await onCounted?.(used).catch(() => {});

  // Nothing is sent before moderation has passed.
  const mod = await moderation;
  if (mod.flagged) {
    abort.abort();
    return { kind: "flagged" };
  }

  try {
    const r = await answer;
    const u = r.totalUsage ?? r.usage;
    await db.rpc("telegram_record_rem_tokens", {
      p_chat_id: chatId,
      p_input: u?.inputTokens ?? 0,
      p_cached: u?.inputTokenDetails?.cacheReadTokens ?? 0,
      p_output: u?.outputTokens ?? 0,
    });
    // The VENN line becomes a picture; text-art drawings are dropped; Amharic answers get "ጠቃሚ ምክር፡".
    const { text, spec: venn } = extractVenn(r.text);
    const split = splitFollowups(text, FOLLOWUPS_MARK);
    const body = localizeTip(stripTextArt(split.body));
    if (!body) return { kind: "error" };
    const remembered = venn ? `${body}\n${vennHistoryNote(venn)}` : body;
    return {
      kind: "answer",
      html: mdToTelegramHtml(body),
      followups: split.followups,
      venn,
      used,
      history: [...history, { role: "user" as const, content: q.slice(0, 600) }, { role: "assistant" as const, content: remembered.slice(0, 900) }].slice(-4),
    };
  } catch {
    return { kind: "error" };
  }
}
