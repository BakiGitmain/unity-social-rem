import "server-only";
import type { AdminContext } from "@/lib/admin/auth";

/**
 * Read-modify-write one app_settings row as the admin (RLS: is_admin), with an audit row (before/after).
 * Only call after requireAdmin() (adminAction does that).
 */
export async function saveSetting(
  ctx: AdminContext,
  key: "site" | "maintenance" | "features" | "ai" | "notes",
  update: (current: Record<string, unknown>) => Record<string, unknown>,
  action = `settings.${key}`,
) {
  const { data, error } = await ctx.supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error("Could not read settings");
  const before = (data?.value ?? {}) as Record<string, unknown>;
  const after = update(before);
  const { error: e2 } = await ctx.supabase
    .from("app_settings")
    .upsert({ key, value: after, is_public: key !== "ai", updated_at: new Date().toISOString(), updated_by: ctx.userId });
  if (e2) throw new Error("Could not save settings");
  // Never store the full system prompt twice in the log: it has its own version table.
  const strip = (v: Record<string, unknown>) => (key === "ai" ? { ...v, system_prompt: v.system_prompt ? "(custom)" : null } : v);
  await ctx.audit(action, "settings", key, strip(before), strip(after));
  return after;
}
