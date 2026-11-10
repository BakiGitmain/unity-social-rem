import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { ContentTree, type TreeSubject } from "@/components/admin/pages/content-tree";

export const metadata: Metadata = { title: "Content" };

export default async function ContentPage() {
  const ctx = await requireAdmin().catch(() => notFound());
  const [{ data, error }, { data: drafts }] = await Promise.all([
    ctx.supabase
      .from("subjects")
      .select(
        "id, slug, name_en, status, sort_order, color, grades(id, number, name_en, status, units(id, number, label_en, title_en, status, lessons(id, code, title_en, status, sort_order, updated_at)))",
      )
      .order("sort_order"),
    ctx.supabase.from("lesson_drafts").select("lesson_id"),
  ]);
  if (error) throw new Error("Could not load content");
  const subjects = (data ?? []) as unknown as TreeSubject[];
  for (const s of subjects) {
    s.grades.sort((a, b) => a.number - b.number);
    for (const g of s.grades) {
      g.units.sort((a, b) => a.number - b.number);
      for (const u of g.units) u.lessons.sort((a, b) => a.sort_order - b.sort_order);
    }
  }
  return <ContentTree subjects={subjects} drafts={(drafts ?? []).map((d) => d.lesson_id as string)} />;
}
