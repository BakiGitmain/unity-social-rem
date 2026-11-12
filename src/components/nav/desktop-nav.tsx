"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { NotebookPen } from "lucide-react";
import { useDueCount } from "@/lib/notes/use-due";
import { t, type SiteKey } from "@/lib/site-i18n";
import { useSiteSettings } from "@/components/site-settings";
import type { Locale } from "@/lib/locale";

/** Middle nav links: Home · Schedule · Notes. */
const LINKS: { href: string; key: SiteKey; match: (p: string) => boolean; icon?: boolean }[] = [
  { href: "/", key: "home", match: (p) => !/^\/(login|signup|schedule|notes)/.test(p) },
  { href: "/schedule", key: "schedule", match: (p) => p.startsWith("/schedule") },
  { href: "/notes", key: "notes", match: (p) => p.startsWith("/notes"), icon: true },
];

export function DesktopNav({ locale }: { locale: Locale }) {
  const pathname = (usePathname() || "/").replace(/^\/(en|am)(?=\/|$)/, "") || "/";
  const { settings } = useSiteSettings();
  const links = LINKS.filter((l) => l.href !== "/schedule" || settings.features.schedule);
  const due = useDueCount();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {links.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? "text-ink" : "text-muted hover:text-ink"
            } ${locale === "am" ? "am" : ""}`}
          >
            {active && (
              <motion.span
                layoutId="desktop-nav-pill"
                className="absolute inset-0 rounded-full bg-ink/[0.06]"
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {l.icon && <NotebookPen className="size-4" aria-hidden />}
              {t(locale, l.key)}
              {l.icon && due > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white tabular-nums" aria-label={`${due} due`}>
                  {due > 99 ? "99+" : due}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
