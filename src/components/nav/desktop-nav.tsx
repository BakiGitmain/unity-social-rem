"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { t, type SiteKey } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";

/** Middle nav links. One item for now; the sliding indicator is ready for more. */
const LINKS: { href: string; key: SiteKey; match: (p: string) => boolean }[] = [
  { href: "/", key: "home", match: (p) => !/^\/(login|signup|schedule)/.test(p) },
  { href: "/schedule", key: "schedule", match: (p) => p.startsWith("/schedule") },
];

export function DesktopNav({ locale }: { locale: Locale }) {
  const pathname = (usePathname() || "/").replace(/^\/(en|am)(?=\/|$)/, "") || "/";
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {LINKS.map((l) => {
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
            <span className="relative">{t(locale, l.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
