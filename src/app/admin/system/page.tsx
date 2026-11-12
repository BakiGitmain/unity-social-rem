import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { SystemView, type AdminSession } from "@/components/admin/pages/system";

export const metadata: Metadata = { title: "System" };

export default async function SystemPage() {
  const ctx = await requireAdmin().catch(() => notFound());
  const [{ data, error }, { data: sessions }] = await Promise.all([ctx.supabase.rpc("admin_system_stats"), ctx.supabase.rpc("admin_my_sessions")]);
  if (error) throw new Error("Could not load system stats");
  return (
    <SystemView
      stats={data as { tables: Record<string, number>; storage_bytes: number; storage_files: number; db_bytes: number }}
      sessions={(sessions ?? []) as AdminSession[]}
    />
  );
}
