"use client";

import Link from "next/link";
import { PencilLine } from "lucide-react";
import type { QuestionStat } from "@/lib/admin/queries";
import { DataTable, type Column } from "@/components/admin/data-table";
import { useLiveRefresh } from "@/components/live";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/admin/ui";

type LessonRow = { id: string; code: string; title: string; subjectName: string; status: string; attempts: number; avg: number | null; starts: number };

function PctBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-faint">—</span>;
  const tone = value >= 70 ? "bg-good" : value >= 50 ? "bg-tip" : "bg-bad";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      <span className="tabular-nums">{Math.round(value)}%</span>
    </span>
  );
}

export function QuizAnalytics({ lessons, questions }: { lessons: LessonRow[]; questions: QuestionStat[] }) {
  useLiveRefresh({ key: "admin-quizzes" });
  const L = new Map(lessons.map((l) => [l.id, l]));
  const rows = questions.map((q) => ({ ...q, pct: q.answered ? (q.correct / q.answered) * 100 : null, lesson: L.get(q.lesson_id) }));
  const hardest = rows
    .filter((q) => q.answered >= 3 && q.pct !== null)
    .sort((a, b) => a.pct! - b.pct!)
    .slice(0, 10);

  const lessonCols: Column<LessonRow>[] = [
    { id: "lesson", header: "Lesson", sort: (l) => l.code, search: (l) => `${l.code} ${l.title}`, cell: (l) => <span className="font-medium text-ink">{l.code} {l.title}</span> },
    { id: "subject", header: "Subject", sort: (l) => l.subjectName, cell: (l) => <span className="text-muted">{l.subjectName}</span> },
    { id: "attempts", header: "Attempts", sort: (l) => l.attempts, cell: (l) => <span className="tabular-nums">{l.attempts}</span> },
    { id: "avg", header: "Average score", sort: (l) => l.avg ?? -1, csv: (l) => l.avg, cell: (l) => <PctBar value={l.avg === null ? null : Number(l.avg)} /> },
    {
      id: "completion",
      header: "Completion rate",
      sort: (l) => (l.starts ? l.attempts / l.starts : -1),
      csv: (l) => (l.starts ? Math.round((Math.min(l.attempts, l.starts) / l.starts) * 100) : null),
      cell: (l) => (l.starts ? <PctBar value={(Math.min(l.attempts, l.starts) / l.starts) * 100} /> : <span className="text-faint">—</span>),
    },
  ];

  type QRow = (typeof rows)[number];
  const qCols: Column<QRow>[] = [
    { id: "lesson", header: "Lesson", sort: (q) => `${q.lesson?.code ?? ""}-${String(q.sort_order).padStart(3, "0")}`, cell: (q) => <span className="text-muted tabular-nums">{q.lesson?.code} · Q{q.sort_order}</span> },
    { id: "question", header: "Question", sort: (q) => q.question_en, cell: (q) => <span className="line-clamp-2 max-w-md text-ink">{q.question_en}</span> },
    { id: "answered", header: "Answers", sort: (q) => q.answered, cell: (q) => <span className="tabular-nums">{q.answered}</span> },
    { id: "correct", header: "% correct", sort: (q) => q.pct ?? 999, csv: (q) => (q.pct === null ? null : Math.round(q.pct)), cell: (q) => <PctBar value={q.pct} /> },
    {
      id: "wrong",
      header: "Most-chosen wrong answer",
      sort: (q) => q.top_wrong_count,
      csv: (q) => (q.top_wrong === null ? "" : q.options_en[q.top_wrong]),
      cell: (q) =>
        q.top_wrong === null ? (
          <span className="text-faint">—</span>
        ) : (
          <span className="text-sm">
            <span className="text-bad">{q.options_en[q.top_wrong]}</span> <span className="text-faint">({q.top_wrong_count}×)</span>
          </span>
        ),
    },
    {
      id: "edit",
      header: "",
      cell: (q) => (
        <Link href={`/admin/content/lessons/${q.lesson_id}?tab=quiz&q=${q.question_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline" onClick={(e) => e.stopPropagation()}>
          <PencilLine className="size-3.5" aria-hidden /> Edit
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Quiz analytics" sub="Find confusing questions: low % correct, or one wrong answer that many students pick." />

      <Card className="mb-4">
        <CardTitle sub="At least 3 answers, lowest % correct first">Hardest questions</CardTitle>
        {hardest.length === 0 ? (
          <EmptyState title="Not enough answers yet" text="Questions show up here once students have answered them a few times." />
        ) : (
          <ol className="space-y-1.5">
            {hardest.map((q) => (
              <li key={q.question_id}>
                <Link href={`/admin/content/lessons/${q.lesson_id}?tab=quiz&q=${q.question_id}`} className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5 text-sm hover:bg-[var(--accent-tint)]">
                  <Badge tone={q.pct! < 40 ? "bad" : "warn"}>{Math.round(q.pct!)}%</Badge>
                  <span className="min-w-0 flex-1 truncate text-ink">{q.question_en}</span>
                  {q.top_wrong !== null && <span className="hidden max-w-56 truncate text-xs text-bad md:inline">picked: {q.options_en[q.top_wrong]}</span>}
                  <span className="shrink-0 text-xs text-faint">{q.lesson?.code}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card className="mb-4">
        <CardTitle>Per lesson</CardTitle>
        <DataTable rows={lessons} columns={lessonCols} rowKey={(l) => l.id} csvName="quiz-lessons" searchPlaceholder="Search lessons…" initialSort={{ id: "lesson", dir: "asc" }} pageSize={10} />
      </Card>

      <Card>
        <CardTitle>Per question</CardTitle>
        <DataTable
          rows={rows}
          columns={qCols}
          rowKey={(q) => q.question_id}
          csvName="quiz-questions"
          searchPlaceholder="Search questions…"
          initialSort={{ id: "correct", dir: "asc" }}
          filters={[
            {
              id: "lesson",
              label: "Lesson",
              options: lessons.map((l) => ({ value: l.id, label: `${l.code} ${l.title}` })),
              test: (q, v) => q.lesson_id === v,
            },
          ]}
        />
      </Card>
    </div>
  );
}
