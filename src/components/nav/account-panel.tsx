"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, LogOut, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { logOut } from "@/lib/auth/actions";
import { useUser } from "@/components/user-provider";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";

/** Where to come back to after logging in: the page the user is on now. */
export function useNextParam() {
  const pathname = usePathname() || "/";
  const clean = pathname.replace(/^\/(en|am)(?=\/|$)/, "") || "/";
  return /^\/(login|signup)/.test(clean) ? "/" : clean;
}

/** The menu content, shared by the desktop dropdown and the mobile bottom sheet. */
export function AccountPanel({ locale, onDone, size = "sm" }: { locale: Locale; onDone: () => void; size?: "sm" | "lg" }) {
  const { username, isAdmin, loading, refresh } = useUser();
  const next = useNextParam();
  const [pending, startTransition] = useTransition();
  const big = size === "lg";

  const item = `flex w-full items-center gap-3 rounded-xl px-3 text-left font-medium text-ink transition-colors hover:bg-paper active:bg-line/60 ${
    big ? "py-3.5 text-base" : "py-2.5 text-sm"
  }`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6" role="status">
        <span className="spinner" aria-hidden />
      </div>
    );
  }

  if (username) {
    return (
      <div>
        <div className={`flex items-center gap-3 px-3 ${big ? "py-3" : "py-2"}`}>
          <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
            <UserRound className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className={`text-xs text-muted ${locale === "am" ? "am" : ""}`}>{t(locale, "signedInAs")}</p>
            <p className="truncate font-semibold text-ink">@{username}</p>
          </div>
        </div>
        <div className="my-1.5 h-px bg-line" />
        {isAdmin && (
          <Link href="/admin" onClick={onDone} className={`${item} ${locale === "am" ? "am" : ""}`}>
            <ShieldCheck className="size-4.5 text-accent" aria-hidden />
            {t(locale, "adminDashboard")}
          </Link>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await logOut();
              await refresh();
              onDone();
            })
          }
          className={`${item} disabled:opacity-60 ${locale === "am" ? "am" : ""}`}
        >
          {pending ? <span className="spinner !size-4" aria-hidden /> : <LogOut className="size-4.5 text-muted" aria-hidden />}
          {t(locale, "logout")}
        </button>
      </div>
    );
  }

  const q = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className={locale === "am" ? "am" : ""}>
      <Link href={`/login${q}`} onClick={onDone} className={item}>
        <LogIn className="size-4.5 text-muted" aria-hidden />
        {t(locale, "login")}
      </Link>
      <Link href={`/signup${q}`} onClick={onDone} className={item}>
        <UserPlus className="size-4.5 text-muted" aria-hidden />
        {t(locale, "signup")}
      </Link>
      {big && <p className="px-3 pt-2 text-sm text-muted">{t(locale, "optionalAccount")}</p>}
    </div>
  );
}
