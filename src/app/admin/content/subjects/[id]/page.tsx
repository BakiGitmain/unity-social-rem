import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { SubjectSettings } from "@/components/admin/pages/subject-settings";

export const metadata: Metadata = { title: "Subject settings" };

export default async function SubjectPage({ params }: PageProps<"/admin/content/subjects/[id]">) {
  const ctx = await requireAdmin().catch(() => notFound());
  const { id } = await params;
  const { data } = await ctx.supabase
    .from("subjects")
    .select("id, slug, name_en, name_am, description_en, description_am, color, icon, illustration, status")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  return <SubjectSettings subject={data as Parameters<typeof SubjectSettings>[0]["subject"]} />;
}
