import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAiStats, getFeedback, getLessonIndex, getQuestionStats, getStats, parseRange } from "@/lib/admin/queries";
import { OverviewView } from "@/components/admin/pages/overview";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: PageProps<"/admin">) {
  const ctx = await requireAdmin().catch(() => notFound());
  const days = parseRange((await searchParams).range);
  const [stats, ai, feedback, questions, lessons] = await Promise.all([
    getStats(ctx, days),
    getAiStats(ctx, 1),
    getFeedback(ctx, { onlyDown: true, limit: 50 }),
    getQuestionStats(ctx),
    getLessonIndex(ctx),
  ]);
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const hardest = questions
    .filter((q) => q.answered >= 3)
    .map((q) => ({ ...q, pct: q.correct / q.answered, lesson: lessonById.get(q.lesson_id) }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  return (
    <OverviewView
      stats={stats}
      days={days}
      unreviewedDown={feedback.filter((f) => !f.reviewed_at)}
      hardest={hardest.map((q) => ({
        id: q.question_id,
        lessonId: q.lesson_id,
        text: q.question_en,
        pct: q.pct,
        answered: q.answered,
        lesson: q.lesson ? `${q.lesson.code} ${q.lesson.title}` : "",
      }))}
      hitLimit={ai.hit_limit_today}
    />
  );
}
