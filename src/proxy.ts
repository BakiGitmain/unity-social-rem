import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/lib/locale";

/**
 * 1) Site language: rewrites /geography → /en/geography (or /am/...) based on the language cookie.
 *    The URL in the browser stays the same; each language is its own prerendered page (fast, no flash).
 * 2) Auth: refreshes the Supabase session cookie when one exists.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];

  let target: URL | null = null;
  if (!isLocale(first)) {
    const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookie) ? cookie : DEFAULT_LOCALE;
    target = request.nextUrl.clone();
    target.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  }

  const makeResponse = () =>
    target ? NextResponse.rewrite(target, { request }) : NextResponse.next({ request });
  let response = makeResponse();

  // Only talk to Supabase when the visitor actually has a session cookie.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (hasSession) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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
      },
    );
    // Validates the JWT and refreshes it if it expired. Do not remove.
    await supabase.auth.getClaims();
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, API routes and static files.
    "/((?!_next/static|_next/image|api|favicon.ico|illustrations|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
