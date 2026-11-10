import "server-only";
import { connection } from "next/server";
import type { AdminContext } from "@/lib/admin/auth";

/* Read-only loaders for admin pages. All go through the admin's own session (RLS + is_admin() with 2FA). */

export type Stats = {
  days: number;
  users_total: number;
  users_new_today: number;
  users_new_week: number;
  users_new_prev_week: number;
  users_new_period: number;
  users_new_prev_period: number;
  dau: number;
  dau_prev: number;
  wau: number;
  wau_prev: number;
  mau: number;
  lessons_published: number;
  lessons_total: number;
  completions: number;
  completions_prev: number;
  attempts: number;
  attempts_prev: number;
  avg_score: number | null;
  avg_score_prev: number | null;
  ai_today: number;
  ai_yesterday: number;
  ai_cost_today: number;
  ai_cost_month: number;
  ai_cost_prev_month: number;
  ai_budget: number;
  series: { day: string; signups: number; active: number; views: number; completions: number; ai: number; ai_cost: number }[];
  views_by_subject: { subject: string; views: number }[];
};

export type AiStats = {
  series: { day: string; messages: number; input: number; cached: number; output: number; searches: number; blocked: number; cost: number }[];
  top_users: { id: string; username: string; messages: number; searches: number; hit_limit: boolean }[];
  by_lesson: { id: string; code: string; title_en: string; n: number }[];
  hit_limit_today: { id: string; username: string; messages: number }[];
};

export type QuestionStat = {
  question_id: string;
  lesson_id: string;
  sort_order: number;
  question_en: string;
  options_en: string[];
  correct_index: number;
  answered: number;
  correct: number;
  top_wrong: number | null;
  top_wrong_count: number;
};

export function parseRange(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return [7, 30, 90].includes(n) ? n : 30;
}

export async function getStats(ctx: AdminContext, days: number) {
  const { data, error } = await ctx.supabase.rpc("admin_stats", { p_days: days });
  if (error) throw new Error("Could not load statistics");
  return data as Stats;
}

export async function getAiStats(ctx: AdminContext, days: number) {
  const { data, error } = await ctx.supabase.rpc("admin_ai_stats", { p_days: days });
  if (error) throw new Error("Could not load AI statistics");
  return data as AiStats;
}

export async function getQuestionStats(ctx: AdminContext) {
  const { data, error } = await ctx.supabase.rpc("admin_question_stats");
  if (error) throw new Error("Could not load question statistics");
  return (data ?? []) as QuestionStat[];
}

/** Lessons with their place in the tree (for labels and links). */
export async function getLessonIndex(ctx: AdminContext) {
  const { data } = await ctx.supabase
    .from("lessons")
    .select("id, code, title_en, status, units(label_en, grades(number, subjects(slug, name_en)))")
    .order("code");
  return (data ?? []).map((l) => {
    const u = l.units as unknown as { label_en: string; grades: { number: number; subjects: { slug: string; name_en: string } | null } | null } | null;
    return {
      id: l.id as string,
      code: l.code as string,
      title: l.title_en as string,
      status: l.status as string,
      subject: u?.grades?.subjects?.slug ?? "",
      subjectName: u?.grades?.subjects?.name_en ?? "",
      grade: u?.grades?.number ?? 0,
      unit: u?.label_en ?? "",
    };
  });
}

export type FeedbackRow = {
  id: number;
  user_id: string;
  username: string | null;
  lesson_id: string | null;
  lesson: string | null;
  rating: number;
  question: string | null;
  answer: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export async function getFeedback(ctx: AdminContext, opts: { onlyDown?: boolean; limit?: number } = {}) {
  let q = ctx.supabase
    .from("ai_feedback")
    .select("id, user_id, lesson_id, rating, question, answer, created_at, reviewed_at, lessons(code, title_en)")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 300);
  if (opts.onlyDown) q = q.eq("rating", -1);
  const { data } = await q;
  const ids = [...new Set((data ?? []).map((r) => r.user_id as string))];
  const { data: names } = ids.length ? await ctx.supabase.from("profiles").select("id, username").in("id", ids) : { data: [] };
  const byId = new Map((names ?? []).map((n) => [n.id as string, n.username as string]));
  return (data ?? []).map((r) => {
    const l = r.lessons as unknown as { code: string; title_en: string } | null;
    return {
      id: r.id as number,
      user_id: r.user_id as string,
      username: byId.get(r.user_id as string) ?? null,
      lesson_id: r.lesson_id as string | null,
      lesson: l ? `${l.code} ${l.title_en}` : null,
      rating: r.rating as number,
      question: r.question as string | null,
      answer: r.answer as string | null,
      created_at: r.created_at as string,
      reviewed_at: r.reviewed_at as string | null,
    } satisfies FeedbackRow;
  });
}

/** The current time for one request (never during prerendering). */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}

/** Adds `banned` (ban still running right now), computed on the server at request time. */
export async function withBanState<T extends { banned_until: string | null }>(rows: T[]): Promise<(T & { banned: boolean })[]> {
  const now = await requestNow();
  return rows.map((u) => ({ ...u, banned: !!u.banned_until && new Date(u.banned_until).getTime() > now }));
}
