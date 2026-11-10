import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getLessonIndex, withBanState } from "@/lib/admin/queries";
import type { AdminUser } from "@/components/admin/pages/users";
import { UserDetailView } from "@/components/admin/pages/user-detail";

export const metadata: Metadata = { title: "User" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const ctx = await requireAdmin().catch(() => notFound());
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sb = ctx.supabase;

  const [users, events, progress, attempts, usage, chats, lessons] = await Promise.all([
    sb.rpc("admin_users"),
    sb.from("events").select("id, type, created_at, lesson_id, metadata").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
    sb.from("lesson_progress").select("lesson_id, parts_done, total_parts, completed_at, best_quiz_score, best_quiz_total, updated_at").eq("user_id", id),
    sb.from("quiz_attempts").select("id, lesson_id, score, total, duration_ms, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
    sb.from("ai_usage").select("day, messages, searches, input_tokens, output_tokens").eq("user_id", id).order("day", { ascending: false }).limit(60),
    sb.from("ai_chats").select("lesson_id, updated_at").eq("user_id", id).order("updated_at", { ascending: false }),
    getLessonIndex(ctx),
  ]);
  const row = ((users.data ?? []) as Omit<AdminUser, "banned">[]).find((u) => u.id === id);
  if (!row) notFound();
  const [user] = (await withBanState([row])) as AdminUser[];

  return (
    <UserDetailView
      user={user}
      me={ctx.userId}
      events={events.data ?? []}
      progress={progress.data ?? []}
      attempts={attempts.data ?? []}
      usage={usage.data ?? []}
      chats={chats.data ?? []}
      lessons={lessons}
    />
  );
}
