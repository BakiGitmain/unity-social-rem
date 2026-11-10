import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { requestNow } from "@/lib/admin/queries";
import { AnnouncementsAdmin, type AnnRow } from "@/components/admin/pages/announcements-admin";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage({ searchParams }: PageProps<"/admin/announcements">) {
  const ctx = await requireAdmin().catch(() => notFound());
  const { data } = await ctx.supabase.from("announcements").select("*").order("created_at", { ascending: false });
  return <AnnouncementsAdmin rows={(data ?? []) as AnnRow[]} openNew={(await searchParams).new === "1"} now={await requestNow()} />;
}
