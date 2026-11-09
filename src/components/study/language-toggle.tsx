"use client";

import { motion } from "framer-motion";
import type { Lang } from "@/lib/types";

const OPTIONS: { value: Lang; label: string; am?: boolean }[] = [
  { value: "en", label: "English" },
  { value: "am", label: "አማርኛ", am: true },
  { value: "both", label: "Both" },
];

export function LanguageToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div role="radiogroup" aria-label="Language" className="inline-flex rounded-full border border-line bg-surface p-1">
      {OPTIONS.map((o) => {
        const active = lang === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
              active ? "text-white" : "text-muted hover:text-ink"
            } ${o.am ? "am leading-normal" : ""}`}
          >
            {active && (
              <motion.span
                layoutId="lang-pill"
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
