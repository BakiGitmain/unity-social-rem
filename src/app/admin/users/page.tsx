import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withBanState } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { UsersView, type AdminUser } from "@/components/admin/pages/users";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const ctx = await requireAdmin().catch(() => notFound());
  const { data, error } = await ctx.supabase.rpc("admin_users");
  if (error) throw new Error("Could not load users");
  const users = await withBanState((data ?? []) as Omit<AdminUser, "banned">[]);
  return <UsersView users={users} me={ctx.userId} />;
}
