"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MIN_PASSWORD, USERNAME_RE, normalizeUsername, safeNext, usernameToEmail } from "@/lib/auth/username";
import type { SiteKey } from "@/lib/site-i18n";

export type AuthState = { error: SiteKey; username: string } | null;

function isRateLimited(err: { status?: number; code?: string } | null) {
  return err?.status === 429 || err?.code === "over_request_rate_limit" || err?.code === "over_email_send_rate_limit";
}

export async function logIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");

  // Same generic message for every failure: never reveal which part was wrong.
  if (!USERNAME_RE.test(username) || !password) return { error: "errWrongCredentials", username };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error) return { error: isRateLimited(error) ? "errTooMany" : "errWrongCredentials", username };

  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");

  if (!USERNAME_RE.test(username)) return { error: "errInvalidUsername", username };
  if (password.length < MIN_PASSWORD) return { error: "errShortPassword", username };

  const supabase = await createClient();

  const { data: existing } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existing) return { error: "errTaken", username };

  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { username } },
  });

  if (error) {
    if (isRateLimited(error)) return { error: "errTooMany", username };
    if (error.code === "weak_password") return { error: "errShortPassword", username };
    // "user_already_exists", or the profile insert hit the unique username at the same moment.
    if (error.code === "user_already_exists" || error.code === "unexpected_failure" || /already|database error/i.test(error.message))
      return { error: "errTaken", username };
    return { error: "errGeneric", username };
  }
  // Supabase hides existing accounts by returning a user with no identities.
  if (data.user && data.user.identities?.length === 0) return { error: "errTaken", username };
  if (!data.session) return { error: "errGeneric", username };

  redirect(safeNext(formData.get("next")));
}

export async function logOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
