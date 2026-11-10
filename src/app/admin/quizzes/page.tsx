import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getLessonIndex, getQuestionStats } from "@/lib/admin/queries";
import { QuizAnalytics } from "@/components/admin/pages/quiz-analytics";

export const metadata: Metadata = { title: "Quiz analytics" };

export default async function QuizzesPage() {
  const ctx = await requireAdmin().catch(() => notFound());
  const [lessons, questions, { data: perLesson }] = await Promise.all([
    getLessonIndex(ctx),
    getQuestionStats(ctx),
    ctx.supabase.rpc("admin_lesson_quiz_stats"),
  ]);
  const stats = new Map(((perLesson ?? []) as { lesson_id: string; attempts: number; avg_pct: number | null; starts: number }[]).map((s) => [s.lesson_id, s]));
  return (
    <QuizAnalytics
      lessons={lessons.map((l) => ({ ...l, attempts: Number(stats.get(l.id)?.attempts ?? 0), avg: stats.get(l.id)?.avg_pct ?? null, starts: Number(stats.get(l.id)?.starts ?? 0) }))}
      questions={questions.map((q) => ({ ...q, answered: Number(q.answered), correct: Number(q.correct), top_wrong_count: Number(q.top_wrong_count) }))}
    />
  );
}
