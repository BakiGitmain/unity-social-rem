"use server";

import { randomInt } from "node:crypto";
import { adminAction, fail } from "@/lib/admin/action";
import type { AdminContext } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { USERNAME_RE, normalizeUsername, usernameToEmail } from "@/lib/auth/username";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function checkIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !ids.every((x) => typeof x === "string" && UUID.test(x))) fail("Invalid users");
  return ids as string[];
}

/** Profile + role of the targets; refuses actions on yourself or (for destructive ones) on other admins. */
async function targets(ctx: AdminContext, ids: string[], opts: { notSelf?: boolean; notAdmins?: boolean } = {}) {
  const [{ data: profiles }, { data: priv }] = await Promise.all([
    ctx.supabase.from("profiles").select("id, username").in("id", ids),
    ctx.supabase.from("profiles_private").select("id, role").in("id", ids),
  ]);
  const roles = new Map((priv ?? []).map((p) => [p.id as string, p.role as string]));
  const list = (profiles ?? []).map((p) => ({ id: p.id as string, username: p.username as string, role: roles.get(p.id as string) ?? "student" }));
  if (list.length !== ids.length) fail("User not found");
  if (opts.notSelf && list.some((t) => t.id === ctx.userId)) fail("You can't do this to your own account");
  if (opts.notAdmins && list.some((t) => t.role === "admin")) fail("Change the admin's role to student first");
  return list;
}

export async function banUsers(ids: string[], hours: number | null, reason: string) {
  return adminAction(async (ctx) => {
    const list = await targets(ctx, checkIds(ids), { notSelf: true, notAdmins: true });
    const h = hours === null ? 876000 : Math.round(Number(hours));
    if (!Number.isFinite(h) || h < 1 || h > 876000) fail("Invalid ban length");
    const admin = createAdminClient();
    for (const t of list) {
      const { error } = await admin.auth.admin.updateUserById(t.id, { ban_duration: `${h}h` });
      if (error) fail(`Could not ban @${t.username}`);
      await ctx.supabase.rpc("admin_revoke_sessions", { p_user: t.id });
      await ctx.audit("user.ban", "user", t.id, null, { username: t.username, hours: hours === null ? "permanent" : h, reason: String(reason ?? "").slice(0, 300) });
    }
    return list.length;
  });
}

export async function unbanUsers(ids: string[]) {
  return adminAction(async (ctx) => {
    const list = await targets(ctx, checkIds(ids));
    const admin = createAdminClient();
    for (const t of list) {
      const { error } = await admin.auth.admin.updateUserById(t.id, { ban_duration: "none" });
      if (error) fail(`Could not unban @${t.username}`);
      await ctx.audit("user.unban", "user", t.id, null, { username: t.username });
    }
    return list.length;
  });
}

export async function forceLogout(ids: string[]) {
  return adminAction(async (ctx) => {
    const list = await targets(ctx, checkIds(ids), { notSelf: true });
    let sessions = 0;
    for (const t of list) {
      const { data, error } = await ctx.supabase.rpc("admin_revoke_sessions", { p_user: t.id });
      if (error) fail(`Could not sign out @${t.username}`);
      sessions += Number(data ?? 0);
      await ctx.audit("user.force_logout", "user", t.id, null, { username: t.username, sessions: data });
    }
    return sessions;
  });
}

/** A readable temporary password (no 0/O/1/l). Shown ONCE to the admin, never stored or logged. */
function tempPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += abc[randomInt(abc.length)];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

export async function resetPassword(id: string) {
  return adminAction(async (ctx) => {
    const [t] = await targets(ctx, checkIds([id]), { notSelf: true });
    const password = tempPassword();
    const { error } = await createAdminClient().auth.admin.updateUserById(t!.id, { password });
    if (error) fail("Could not reset the password");
    await ctx.supabase.rpc("admin_revoke_sessions", { p_user: t!.id });
    await ctx.audit("user.reset_password", "user", t!.id, null, { username: t!.username });
    return { password };
  });
}

export async function changeUsername(id: string, newName: string) {
  return adminAction(async (ctx) => {
    const [t] = await targets(ctx, checkIds([id]));
    const name = normalizeUsername(newName);
    if (!USERNAME_RE.test(name)) fail("Use 3–20 characters: a-z, 0-9 or _");
    if (name === t!.username) return name;
    const { data: taken } = await ctx.supabase.from("profiles").select("id").eq("username", name).maybeSingle();
    if (taken) fail("That username is already taken");

    // 1) the public profile (the DB trigger allows this for admins only)
    const { error } = await ctx.supabase.from("profiles").update({ username: name }).eq("id", t!.id);
    if (error) fail("Could not change the username");
    // 2) the login (auth email + metadata). Roll back the profile if this fails.
    const { error: e2 } = await createAdminClient().auth.admin.updateUserById(t!.id, {
      email: usernameToEmail(name),
      email_confirm: true,
      user_metadata: { username: name },
    });
    if (e2) {
      await ctx.supabase.from("profiles").update({ username: t!.username }).eq("id", t!.id);
      fail("Could not change the login name");
    }
    await ctx.audit("user.rename", "user", t!.id, { username: t!.username }, { username: name });
    return name;
  });
}

export async function changeRole(id: string, role: "student" | "admin") {
  return adminAction(async (ctx) => {
    if (role !== "student" && role !== "admin") fail("Invalid role");
    const [t] = await targets(ctx, checkIds([id]), { notSelf: true });
    const { error } = await ctx.supabase.from("profiles_private").update({ role }).eq("id", t!.id);
    if (error) fail("Could not change the role");
    await ctx.audit("user.role", "user", t!.id, { username: t!.username, role: t!.role }, { role });
    return role;
  });
}

export async function setAiLimit(id: string, limit: number | null) {
  return adminAction(async (ctx) => {
    const [t] = await targets(ctx, checkIds([id]));
    const v = limit === null ? null : Math.round(Number(limit));
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 1000)) fail("Limit must be 0–1000");
    const { data: before } = await ctx.supabase.from("profiles_private").select("ai_daily_limit").eq("id", t!.id).maybeSingle();
    const { error } = await ctx.supabase.from("profiles_private").update({ ai_daily_limit: v }).eq("id", t!.id);
    if (error) fail("Could not save the limit");
    await ctx.audit("user.ai_limit", "user", t!.id, { username: t!.username, limit: before?.ai_daily_limit ?? null }, { limit: v });
    return v;
  });
}

/** Permanently delete an account. The typed username is checked again here, on the server. */
export async function deleteUser(id: string, confirmUsername: string) {
  return adminAction(async (ctx) => {
    const [t] = await targets(ctx, checkIds([id]), { notSelf: true, notAdmins: true });
    if (String(confirmUsername ?? "").trim() !== t!.username) fail("The typed username does not match");
    // Snapshot first: the audit log keeps who it was.
    await ctx.audit("user.delete", "user", t!.id, { username: t!.username, role: t!.role }, null);
    const { error } = await createAdminClient().auth.admin.deleteUser(t!.id);
    if (error) fail("Could not delete the user");
    return null;
  });
}

/** Read one student's saved AI chat for a lesson. Every view is written to the audit log. */
export async function viewUserChat(userId: string, lessonId: string) {
  return adminAction(async (ctx) => {
    checkIds([userId, lessonId]);
    const { data, error } = await ctx.supabase.from("ai_chats").select("messages, updated_at").eq("user_id", userId).eq("lesson_id", lessonId).maybeSingle();
    if (error) fail("Could not load the chat");
    await ctx.audit("user.view_chat", "ai_chat", `${userId}:${lessonId}`, null, null);
    type Part = { type: string; text?: string; input?: { question?: string } };
    const messages = ((data?.messages ?? []) as { id: string; role: string; parts: Part[] }[]).map((m) => ({
      id: m.id,
      role: m.role,
      text: m.parts
        .map((p) => (p.type === "text" ? p.text ?? "" : p.type === "tool-quiz_question" ? `🎯 Quiz: ${p.input?.question ?? ""}` : ""))
        .filter(Boolean)
        .join("\n\n"),
    }));
    return { messages, updated_at: (data?.updated_at as string | undefined) ?? null };
  }, { revalidate: false });
}

/** Delete several accounts from the Users list. The typed confirmation is checked again here. */
export async function deleteUsers(ids: string[], confirmText: string) {
  return adminAction(async (ctx) => {
    const list = await targets(ctx, checkIds(ids), { notSelf: true, notAdmins: true });
    const expected = list.length === 1 ? `@${list[0]!.username}` : `${list.length} users`;
    if (String(confirmText ?? "").trim() !== expected) fail("The typed confirmation does not match");
    const admin = createAdminClient();
    for (const t of list) {
      await ctx.audit("user.delete", "user", t.id, { username: t.username, role: t.role }, null);
      const { error } = await admin.auth.admin.deleteUser(t.id);
      if (error) fail(`Could not delete @${t.username}`);
    }
    return list.length;
  });
}
