/** Shared (client + server) rules for username accounts. */

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const MIN_PASSWORD = 8;

/** Users only ever see their username; Supabase Auth needs an email, so we map it to an internal one (no inbox). */
const EMAIL_DOMAIN = "users.unitysocialrem.app";

export function normalizeUsername(input: unknown): string {
  return String(input ?? "").trim().replace(/^@/, "").toLowerCase();
}

export function usernameToEmail(username: string): string {
  return `${username}@${EMAIL_DOMAIN}`;
}

/** Only allow redirects back to our own pages (no open redirects, no loop to auth pages). */
export function safeNext(next: unknown): string {
  const s = typeof next === "string" ? next : "";
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\")) return "/";
  if (/^\/(en\/|am\/)?(login|signup)(\/|\?|$)/.test(s)) return "/";
  return s;
}

/** 0 = weak, 1 = okay, 2 = strong. Only a hint: simple passwords are allowed. */
export function passwordStrength(pw: string): 0 | 1 | 2 {
  let score = 0;
  if (pw.length >= 10) score++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw) || /[A-Z]/.test(pw)) score++;
  if (pw.length < MIN_PASSWORD) return 0;
  return score >= 2 ? 2 : score === 1 ? 1 : 0;
}
