/**
 * Lessons as the bot sees them (published + reachable), the "which lessons are new?" diff and the quiz poll
 * conversion. Pure functions (tested in lessons.test.ts).
 */
import { TG_LIMITS, clip, plainMath } from "./format.ts";

export type Bi = { en: string; am: string };

export type BotLesson = {
  id: string;
  /** subject/grade/unit/slug, e.g. "mathematics/grade-9/unit-1/1-1" (lesson slugs alone are not unique). */
  key: string;
  code: string;
  title: Bi;
  summary: Bi;
  subject: { slug: string; name: Bi };
  grade: number;
  unit: Bi;
  createdAt: string;
  homeworkCount: number;
  /** ids of the counted homework items (warm-ups excluded) */
  homeworkIds: string[];
  quizCount: number;
  minutes: number | null;
};

/** Site path of a lesson (no locale: the site adds it from the language cookie). */
export function lessonPath(l: Pick<BotLesson, "key">, tab?: "homework" | "quiz"): string {
  return `/${l.key}${tab ? `?tab=${tab}` : ""}`;
}

/** Published lessons that were never announced, oldest first (so announcements arrive in teaching order). */
export function newLessons(published: BotLesson[], sentIds: Set<string>): BotLesson[] {
  return published.filter((l) => !sentIds.has(l.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key));
}

/**
 * Finds a lesson from what an admin typed after /notify: the full key ("mathematics/grade-9/unit-1/1-1"),
 * "subject code" ("geography 1.1.3", "math 1.1") or a unique slug / code.
 */
export function findLesson(lessons: BotLesson[], query: string): BotLesson | BotLesson[] | null {
  const q = query.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  if (!q) return null;
  const exact = lessons.find((l) => l.key === q);
  if (exact) return exact;
  const m = /^([a-z]+)[\s/:]+(.+)$/.exec(q);
  if (m) {
    const [, subj, rest] = m;
    const hits = lessons.filter((l) => l.subject.slug.startsWith(subj!) && (l.code.toLowerCase() === rest || l.key.endsWith(`/${rest}`)));
    if (hits.length === 1) return hits[0]!;
    if (hits.length > 1) return hits;
  }
  const hits = lessons.filter((l) => l.code.toLowerCase() === q || l.key.endsWith(`/${q}`));
  if (hits.length === 1) return hits[0]!;
  return hits.length ? hits : null;
}

/* ------------------------------------------------------------------ quiz polls */

export type QuizRow = {
  id: string;
  kind?: string | null;
  question_en: string;
  question_am: string;
  options_en: string[];
  options_am: string[];
  correct_index: number;
  explanation_en: string;
  explanation_am: string;
};

export type Poll = { id: string; question: string; options: string[]; correct: number; explanation: string };

/**
 * A site quiz question → a Telegram quiz poll in one language (math as Unicode, lengths within Telegram's limits).
 * Only multiple-choice questions can be polls; the rest return null.
 */
export function toPoll(q: QuizRow, lang: "en" | "am", n?: { i: number; total: number }): Poll | null {
  if ((q.kind ?? "choice") !== "choice") return null;
  const opts = lang === "am" && q.options_am?.length === q.options_en.length ? q.options_am : q.options_en;
  if (!opts || opts.length < 2 || opts.length > 10 || q.correct_index < 0 || q.correct_index >= opts.length) return null;
  const options = opts.map((o) => plainMath(o).trim());
  if (options.some((o) => !o || [...o].length > TG_LIMITS.pollOption)) return null;
  const rawQ = plainMath(lang === "am" && q.question_am ? q.question_am : q.question_en).trim();
  const prefix = n ? `${n.i}/${n.total} · ` : "";
  const question = clip(prefix + rawQ, TG_LIMITS.pollQuestion);
  const explanation = clip(plainMath(lang === "am" && q.explanation_am ? q.explanation_am : q.explanation_en).trim(), TG_LIMITS.pollExplanation);
  return { id: q.id, question, options, correct: q.correct_index, explanation };
}

/** Picks `n` questions that can be polls, shuffled with the given random source (Math.random in production). */
export function pickQuiz(rows: QuizRow[], n: number, random: () => number = Math.random): QuizRow[] {
  const ok = rows.filter((r) => toPoll(r, "en") && toPoll(r, "am"));
  const a = [...ok];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, n);
}
