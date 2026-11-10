import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALE_COOKIE, isLocale } from "@/lib/locale";
import { ADMIN_ACTIVE_COOKIE, decideAdminAccess, isAdminPath } from "@/lib/admin/access";
import { mergeSettings, type SiteSettings } from "@/lib/settings";

/**
 * 1) Site language: rewrites /geography → /en/geography (or /am/...) from the language cookie
 *    (or the default language from site settings). Each language is its own prerendered page.
 * 2) Auth: refreshes the Supabase session cookie when one exists.
 * 3) /admin (security layer 1 of 3): non-admins get a plain 404; idle admins are signed out after 30 min.
 * 4) Maintenance mode and feature flags (schedule off → 404).
 */

// Public settings, cached in memory for a few seconds (one tiny REST call at most every 15 s per instance).
let settingsCache: { at: number; value: SiteSettings } | null = null;
async function getSettings(): Promise<SiteSettings> {
  if (settingsCache && Date.now() - settingsCache.at < 15_000) return settingsCache.value;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/app_settings?select=key,value&is_public=eq.true`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }, signal: AbortSignal.timeout(2500) },
    );
    const value = mergeSettings(res.ok ? await res.json() : null);
    settingsCache = { at: Date.now(), value };
    return value;
  } catch {
    return settingsCache?.value ?? mergeSettings(null);
  }
}

const SECURITY_HEADERS = { "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" };

function notFound(request: NextRequest, locale: string) {
  // Any unknown path renders the normal site 404 (with a real 404 status), so /admin looks like it doesn't exist.
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/__not-found__`;
  return NextResponse.rewrite(url, { status: 404 });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  const settings = await getSettings();
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : settings.site.default_locale;
  const admin = isAdminPath(pathname);

  let target: URL | null = null;
  if (!admin && !isLocale(first)) {
    target = request.nextUrl.clone();
    target.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  }

  const makeResponse = () => (target ? NextResponse.rewrite(target, { request }) : NextResponse.next({ request }));
  let response = makeResponse();

  // Only talk to Supabase when the visitor actually has a session cookie.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  const supabase = hasSession
    ? createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = makeResponse();
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      })
    : null;

  // Validates the JWT and refreshes it if it expired. Do not remove.
  const claims = supabase ? (await supabase.auth.getClaims()).data?.claims ?? null : null;

  const isAdminRole = async () => {
    if (!supabase || !claims?.sub) return false;
    const { data } = await supabase.rpc("has_admin_role");
    return data === true;
  };

  /* ---------- /admin: layer 1 ---------- */
  if (admin) {
    const raw = request.cookies.get(ADMIN_ACTIVE_COOKIE)?.value;
    const access = decideAdminAccess({
      hasUser: !!claims?.sub,
      isAdminRole: await isAdminRole(),
      aal: claims?.aal as string | undefined,
      lastActive: raw ? Number(raw) : null,
      now: Date.now(),
    });
    if (access === "not_found") return notFound(request, locale);
    if (access === "expired") {
      await supabase!.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?next=/admin";
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      redirect.cookies.delete(ADMIN_ACTIVE_COOKIE);
      return redirect;
    }
    // Sliding 30-minute idle window (only once 2FA is done).
    if (access === "ok") {
      response.cookies.set(ADMIN_ACTIVE_COOKIE, String(Date.now()), {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
    }
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v);
    return response;
  }

  /* ---------- feature flags + maintenance (student pages) ---------- */
  const page = (isLocale(first) ? pathname.slice(first.length + 1) : pathname) || "/";
  if (!settings.features.schedule && /^\/schedule(\/|$)/.test(page)) return notFound(request, locale);

  if (settings.maintenance.enabled && !/^\/(login|maintenance)(\/|$)/.test(page) && !(await isAdminRole())) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/maintenance`;
    return NextResponse.rewrite(url, { status: 503, headers: { "retry-after": "600" } });
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, API routes and static files.
    "/((?!_next/static|_next/image|api|favicon.ico|illustrations|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
