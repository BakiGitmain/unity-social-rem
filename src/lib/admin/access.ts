/**
 * Who may see /admin. Pure and dependency-free so the proxy, the admin layout and the tests share it.
 *  - not_found: no session, or not an admin → a plain 404 (the admin area must not look like it exists)
 *  - mfa:       an admin without a 2FA (AAL2) session → only the 2FA screen is shown
 *  - ok
 * The 6-digit code is asked ONCE per login on a device: the AAL2 session then lasts as long as that login.
 * (Admins manage their devices in Admin → System → Active admin sessions.)
 */
export type AdminAccess = "not_found" | "mfa" | "ok";

export function decideAdminAccess(input: { hasUser: boolean; isAdminRole: boolean; aal: string | null | undefined }): AdminAccess {
  if (!input.hasUser || !input.isAdminRole) return "not_found";
  if (input.aal !== "aal2") return "mfa";
  return "ok";
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
