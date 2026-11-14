import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import type { BotLesson, QuizRow } from "@/lib/telegram/lessons";
import type { HomeworkItem } from "@/lib/types";

/**
 * Data for the Telegram bot.
 * - Bot tables (telegram_*) are SERVICE ROLE ONLY, so they are read and written with the secret key, ONLY from the
 *   bot's server routes (webhook with its secret header, tick with CRON_SECRET, link with a logged-in user).
 *   The key is never logged or returned.
 * - Lesson content is read with the public client (RLS hides drafts), exactly like the site.
 */
export function botDb() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Bot database is not configured");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
export type BotDb = ReturnType<typeof botDb>;

export type QuizState = { ids: string[]; i: number; score: number; pollId: string; correct: number; subject: string };
export type BotState = {
  quiz?: QuizState;
  followups?: string[];
  /** last Rem turns (short), so a follow-up question has context */
  history?: { role: "user" | "assistant"; content: string }[];
  announce?: string;
};

export type Subscriber = {
  chat_id: number;
  username: string | null;
  first_name: string | null;
  language: "en" | "am";
  reminders_on: boolean;
  active: boolean;
  profile_id: string | null;
  state: BotState;
  created_at: string;
  last_seen: string;
};

export async function touchSubscriber(db: BotDb, u: { chatId: number; username?: string; firstName?: string; languageCode?: string }): Promise<Subscriber> {
  const { data, error } = await db.rpc("telegram_touch", {
    p_chat_id: u.chatId,
    p_username: u.username ?? null,
    p_first_name: u.firstName ?? null,
    p_language: u.languageCode?.startsWith("am") ? "am" : "en",
  });
  if (error || !data) throw new Error(`telegram_touch failed: ${error?.message ?? "no row"}`);
  return data as Subscriber;
}

export async function getSubscriber(db: BotDb, chatId: number): Promise<Subscriber | null> {
  const { data } = await db.from("telegram_subscribers").select("*").eq("chat_id", chatId).maybeSingle();
  return (data as Subscriber | null) ?? null;
}

export async function updateSubscriber(db: BotDb, chatId: number, patch: Partial<Pick<Subscriber, "language" | "reminders_on" | "active" | "profile_id" | "state">>) {
  const { error } = await db.from("telegram_subscribers").update(patch).eq("chat_id", chatId);
  if (error) throw new Error(`update subscriber failed: ${error.message}`);
}

/** Active subscribers (optionally only those with reminders on). */
export async function audience(db: BotDb, opts: { reminders?: boolean } = {}): Promise<Pick<Subscriber, "chat_id" | "language">[]> {
  const out: Pick<Subscriber, "chat_id" | "language">[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from("telegram_subscribers").select("chat_id, language").eq("active", true);
    if (opts.reminders) q = q.eq("reminders_on", true);
    const { data, error } = await q.order("chat_id").range(from, from + 999);
    if (error) throw new Error(`audience failed: ${error.message}`);
    out.push(...((data ?? []) as Pick<Subscriber, "chat_id" | "language">[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function markInactive(db: BotDb, chatIds: number[]) {
  if (!chatIds.length) return;
  await db.from("telegram_subscribers").update({ active: false }).in("chat_id", chatIds);
}

export async function flushSent(db: BotDb, n: number) {
  if (n > 0) await db.rpc("telegram_bump_sent", { p_sent: n });
}

/* ------------------------------------------------------------------ content (public, published only) */

type LRow = {
  id: string;
  slug: string;
  code: string;
  title_en: string;
  title_am: string;
  summary_en: string | null;
  summary_am: string | null;
  minutes: number | null;
  status: string;
  created_at: string;
  homework?: HomeworkItem[] | null;
  quizzes: { quiz_questions: { count: number }[] } | null;
};
type URow = { slug: string; label_en: string; label_am: string; status: string; lessons: LRow[] };
type GRow = { number: number; slug: string; status: string; units: URow[] };
type SRow = { slug: string; name_en: string; name_am: string; status: string; grades: GRow[] };

/** Every published lesson whose subject, grade and unit are published too (what students can open). */
export async function loadLessons(opts: { homework?: boolean } = {}): Promise<BotLesson[]> {
  const lessonCols = `id, slug, code, title_en, title_am, summary_en, summary_am, minutes, status, created_at, ${opts.homework ? "homework, " : ""}quizzes(quiz_questions(count))`;
  const { data, error } = await createPublicClient()
    .from("subjects")
    .select(`slug, name_en, name_am, status, grades(number, slug, status, units(slug, label_en, label_am, status, lessons(${lessonCols})))`);
  if (error) throw new Error(`Could not load lessons: ${error.message}`);
  const out: BotLesson[] = [];
  for (const s of (data ?? []) as unknown as SRow[]) {
    if (s.status !== "published") continue;
    for (const g of s.grades) {
      if (g.status !== "published") continue;
      for (const u of g.units) {
        if (u.status !== "published") continue;
        for (const l of u.lessons) {
          if (l.status !== "published") continue;
          const hw = (l.homework ?? []).filter((h) => !h.warmup);
          out.push({
            id: l.id,
            key: `${s.slug}/${g.slug}/${u.slug}/${l.slug}`,
            code: l.code,
            title: { en: l.title_en, am: l.title_am },
            summary: { en: l.summary_en ?? "", am: l.summary_am ?? "" },
            subject: { slug: s.slug, name: { en: s.name_en, am: s.name_am } },
            grade: g.number,
            unit: { en: u.label_en, am: u.label_am },
            createdAt: l.created_at,
            homeworkCount: opts.homework ? hw.length : 0,
            homeworkIds: opts.homework ? hw.map((h) => h.id) : [],
            quizCount: l.quizzes?.quiz_questions?.[0]?.count ?? 0,
            minutes: l.minutes,
          });
        }
      }
    }
  }
  return out;
}

const QUIZ_COLS = "id, kind, question_en, question_am, options_en, options_am, correct_index, explanation_en, explanation_am";

/** Multiple-choice quiz questions of the given lessons. */
export async function loadQuizRows(lessonIds: string[]): Promise<QuizRow[]> {
  if (!lessonIds.length) return [];
  const { data, error } = await createPublicClient()
    .from("quizzes")
    .select(`lesson_id, quiz_questions(${QUIZ_COLS})`)
    .in("lesson_id", lessonIds);
  if (error) throw new Error(`Could not load quiz questions: ${error.message}`);
  return ((data ?? []) as unknown as { quiz_questions: QuizRow[] }[]).flatMap((q) => q.quiz_questions);
}

export async function loadQuizRow(id: string): Promise<QuizRow | null> {
  const { data } = await createPublicClient().from("quiz_questions").select(QUIZ_COLS).eq("id", id).maybeSingle();
  return (data as QuizRow | null) ?? null;
}

/** Homework done per lesson for a linked site account (service role: the student's own rows only, by id). */
export async function homeworkDone(db: BotDb, profileId: string): Promise<Map<string, string[]>> {
  const { data } = await db.from("homework_progress").select("lesson_id, done").eq("user_id", profileId);
  return new Map(((data ?? []) as { lesson_id: string; done: string[] }[]).map((r) => [r.lesson_id, r.done ?? []]));
}

export async function profileUsername(db: BotDb, profileId: string | null): Promise<string | null> {
  if (!profileId) return null;
  const { data } = await db.from("profiles").select("username").eq("id", profileId).maybeSingle();
  return (data as { username: string } | null)?.username ?? null;
}
