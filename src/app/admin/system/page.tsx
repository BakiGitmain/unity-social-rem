import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { SystemView } from "@/components/admin/pages/system";

export const metadata: Metadata = { title: "System" };

export default async function SystemPage() {
  const ctx = await requireAdmin().catch(() => notFound());
  const { data, error } = await ctx.supabase.rpc("admin_system_stats");
  if (error) throw new Error("Could not load system stats");
  return <SystemView stats={data as { tables: Record<string, number>; storage_bytes: number; storage_files: number; db_bytes: number }} />;
}
