import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { AuditView, type AuditRow } from "@/components/admin/pages/audit";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const ctx = await requireAdmin().catch(() => notFound());
  const { data, error } = await ctx.supabase
    .from("admin_audit_log")
    .select("id, admin_id, admin_username, action, target_type, target_id, before, after, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error("Could not load the audit log");
  return <AuditView rows={(data ?? []) as AuditRow[]} />;
}
