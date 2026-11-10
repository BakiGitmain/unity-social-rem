"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY, type Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "am", label: "አማ" },
];

/** Cookie (read by the proxy so server pages render in the right language) + localStorage. */
function rememberLocale(l: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, l);
  } catch {
    // storage blocked: the cookie still remembers the choice
  }
}

/** Site UI language (English | አማርኛ). Does not touch the lesson-notes language. */
export function SiteLangSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (l: Locale) => {
    if (l === locale) return;
    rememberLocale(l);
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="radiogroup"
      aria-label={t(locale, "language")}
      className={`inline-flex rounded-full bg-ink/[0.05] p-0.5 transition-opacity ${pending ? "opacity-60" : ""}`}
    >
      {OPTIONS.map((o) => {
        const active = o.value === locale;
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.value === "en" ? "English" : "አማርኛ"}
            onClick={() => choose(o.value)}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
            className={`relative rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              active ? "text-ink" : "text-muted hover:text-ink"
            } ${o.value === "am" ? "am leading-normal" : ""}`}
          >
            {active && (
              <motion.span
                layoutId="site-lang-pill"
                className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(29,42,44,0.14)]"
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
