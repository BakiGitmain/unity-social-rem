/**
 * Who may see /admin. Pure and dependency-free so the proxy, the admin layout and the tests share it.
 *  - not_found: no session, or not an admin → a plain 404 (the admin area must not look like it exists)
 *  - expired:   an admin who was idle > 30 min → signed out
 *  - mfa:       an admin without a 2FA (AAL2) session → only the 2FA screen is shown
 *  - ok
 */
export const ADMIN_IDLE_MS = 30 * 60 * 1000;
export const ADMIN_ACTIVE_COOKIE = "usr-admin-active";

export type AdminAccess = "not_found" | "expired" | "mfa" | "ok";

export function decideAdminAccess(input: {
  hasUser: boolean;
  isAdminRole: boolean;
  aal: string | null | undefined;
  /** Last admin activity (epoch ms) from the cookie, or null/NaN when absent. */
  lastActive: number | null;
  now: number;
}): AdminAccess {
  if (!input.hasUser || !input.isAdminRole) return "not_found";
  const last = input.lastActive;
  if (last !== null && Number.isFinite(last) && last > 0 && input.now - last > ADMIN_IDLE_MS) return "expired";
  if (input.aal !== "aal2") return "mfa";
  return "ok";
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
