"use server";

import { adminAction } from "@/lib/admin/action";
import { requireAdmin } from "@/lib/admin/auth";
import { saveSetting } from "@/lib/admin/settings-store";

/** Users + lessons for the command palette. */
export async function paletteData() {
  return adminAction(async ({ supabase }) => {
    const [{ data: users }, { data: lessons }, { data: features }] = await Promise.all([
      supabase.from("profiles").select("id, username").order("username").limit(500),
      supabase.from("lessons").select("id, code, title_en").order("code").limit(500),
      supabase.from("app_settings").select("value").eq("key", "features").maybeSingle(),
    ]);
    return {
      users: users ?? [],
      lessons: (lessons ?? []).map((l) => ({ id: l.id as string, code: l.code as string, title: l.title_en as string })),
      aiOn: (features?.value as { ai_tutor?: boolean } | undefined)?.ai_tutor !== false,
    };
  }, { revalidate: false });
}

/** The AI kill switch (also on the AI page and in Site settings → features). */
export async function toggleAiTutor(on: boolean) {
  return adminAction(async (ctx) => {
    await saveSetting(ctx, "features", (v) => ({ ...v, ai_tutor: !!on }), on ? "ai.enable" : "ai.disable");
    return null;
  });
}

/** Called right after 2FA enrollment / verification succeeds (the session is AAL2 by then). */
export async function logMfaEvent(kind: "enrolled" | "verified") {
  try {
    const ctx = await requireAdmin();
    await ctx.audit(kind === "enrolled" ? "mfa.enroll" : "mfa.verify", "user", ctx.userId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export type ActivityItem = {
  id: number;
  type: string;
  created_at: string;
  username: string | null;
  user_id: string | null;
  lesson: string | null;
  metadata: Record<string, unknown>;
};

/** The live "Recent activity" feed on the overview (polled every ~20 s). */
export async function recentActivity(limit = 25) {
  return adminAction(async ({ supabase }) => {
    const { data, error } = await supabase
      .from("events")
      .select("id, type, created_at, user_id, metadata, lessons(code, title_en)")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 100));
    if (error) throw new Error("Could not load activity");
    const ids = [...new Set((data ?? []).map((e) => e.user_id).filter(Boolean))] as string[];
    const { data: names } = ids.length ? await supabase.from("profiles").select("id, username").in("id", ids) : { data: [] };
    const byId = new Map((names ?? []).map((n) => [n.id as string, n.username as string]));
    return (data ?? []).map((e) => {
      const l = e.lessons as unknown as { code: string; title_en: string } | null;
      return {
        id: e.id as number,
        type: e.type as string,
        created_at: e.created_at as string,
        user_id: e.user_id as string | null,
        username: e.user_id ? byId.get(e.user_id as string) ?? null : null,
        lesson: l ? `${l.code} ${l.title_en}` : null,
        metadata: (e.metadata ?? {}) as Record<string, unknown>,
      } satisfies ActivityItem;
    });
  }, { revalidate: false });
}
