import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ACTIVE_COOKIE, decideAdminAccess, type AdminAccess } from "@/lib/admin/access";

export class AdminDenied extends Error {
  constructor() {
    super("Not found");
  }
}

export type AdminContext = {
  supabase: SupabaseClient;
  userId: string;
  username: string;
  /** Write one row to the append-only audit log (as this admin). */
  audit: (action: string, targetType: string | null, targetId: string | null, before?: unknown, after?: unknown) => Promise<void>;
};

/**
 * The core check, given a user-session client. Verifies the JWT (getClaims), then asks the DATABASE:
 * is_admin() = role 'admin' AND an AAL2 (2FA) session. Never trusts anything sent by the browser.
 */
export async function checkAdmin(supabase: SupabaseClient): Promise<AdminContext> {
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId || data?.claims?.aal !== "aal2") throw new AdminDenied();
  const { data: ok, error } = await supabase.rpc("is_admin");
  if (error || ok !== true) throw new AdminDenied();
  const { data: p } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();

  return {
    supabase,
    userId,
    username: p?.username ?? "",
    audit: async (action, targetType, targetId, before, after) => {
      const { error: e } = await supabase.rpc("log_admin_action", {
        p_action: action,
        p_target_type: targetType,
        p_target_id: targetId,
        p_before: before ?? null,
        p_after: after ?? null,
      });
      if (e) throw new Error("Could not write the audit log");
    },
  };
}

/** For every admin server action and route handler. Throws AdminDenied for anyone else. */
export async function requireAdmin(): Promise<AdminContext> {
  // Request-time only: verifying the session reads the clock (token expiry), which must never happen while prerendering.
  await connection();
  return checkAdmin(await createClient());
}

/** For the admin layout: decides between 404, the 2FA screen and the admin area. */
export async function getAdminGate(): Promise<{ access: AdminAccess; username: string | null; userId: string | null }> {
  // Always per request (never prerendered): reads cookies and the clock (30-minute idle check).
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  let isAdminRole = false;
  let username: string | null = null;
  if (userId) {
    const [{ data: role }, { data: p }] = await Promise.all([
      supabase.rpc("has_admin_role"),
      supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
    ]);
    isAdminRole = role === true;
    username = p?.username ?? null;
  }
  const raw = (await cookies()).get(ADMIN_ACTIVE_COOKIE)?.value;
  const access = decideAdminAccess({
    hasUser: !!userId,
    isAdminRole,
    aal: data?.claims?.aal as string | undefined,
    lastActive: raw ? Number(raw) : null,
    now: Date.now(),
  });
  // A fully verified admin is also double-checked against the database (role + AAL2).
  if (access === "ok") {
    const { data: ok } = await supabase.rpc("is_admin");
    if (ok !== true) return { access: "not_found", username: null, userId: null };
  }
  return { access, username: isAdminRole ? username : null, userId: isAdminRole ? userId : null };
}
