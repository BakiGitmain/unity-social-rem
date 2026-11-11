import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import type { EditorData } from "@/lib/admin/lesson-validate";
import { LessonEditor } from "@/components/admin/pages/lesson-editor";

export const metadata: Metadata = { title: "Edit lesson" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Snapshot (live) → editor data with stable client keys for drag-and-drop. */
function toEditor(snap: Omit<EditorData, "sections" | "quiz"> & { sections: Omit<EditorData["sections"][number], "key">[]; quiz: (Omit<NonNullable<EditorData["quiz"]>, "questions"> & { questions: Omit<NonNullable<EditorData["quiz"]>["questions"][number], "key">[] }) | null }): EditorData {
  return {
    ...snap,
    glossary: snap.glossary ?? [],
    main_topics: snap.main_topics ?? [],
    homework: snap.homework ?? [],
    practice: snap.practice ?? [],
    sections: snap.sections.map((s) => ({ ...s, key: s.id ?? crypto.randomUUID() })),
    quiz: snap.quiz ? { ...snap.quiz, questions: snap.quiz.questions.map((q) => ({ ...q, key: q.id ?? crypto.randomUUID() })) } : null,
  };
}

export default async function EditLessonPage({ params, searchParams }: PageProps<"/admin/content/lessons/[id]">) {
  const ctx = await requireAdmin().catch(() => notFound());
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const [{ data: snap, error }, { data: draft }, { data: where }] = await Promise.all([
    ctx.supabase.rpc("admin_lesson_snapshot", { p_lesson_id: id }),
    ctx.supabase.from("lesson_drafts").select("data, updated_at").eq("lesson_id", id).maybeSingle(),
    ctx.supabase.from("lessons").select("slug, units(slug, grades(slug, subjects(slug)))").eq("id", id).maybeSingle(),
  ]);
  if (error || !snap) notFound();
  const u = where?.units as unknown as { slug: string; grades: { slug: string; subjects: { slug: string } | null } | null } | null;
  const publicHref = u?.grades?.subjects ? `/${u.grades.subjects.slug}/${u.grades.slug}/${u.slug}/${where!.slug}` : null;

  return (
    <LessonEditor
      live={toEditor(snap)}
      draft={draft ? { data: draft.data as EditorData, updated_at: draft.updated_at as string } : null}
      initialTab={typeof sp.tab === "string" ? sp.tab : undefined}
      focusQuestion={typeof sp.q === "string" ? sp.q : undefined}
      publicHref={publicHref}
    />
  );
}
