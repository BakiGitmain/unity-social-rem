"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { TimeFormat } from "@/lib/time/clock";
import type { Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";

/** Text whose characters roll vertically when they change (clock digits, countdowns). */
export function Rolling({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex overflow-hidden tabular-nums ${className}`} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} className="relative inline-block" aria-hidden>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              className="inline-block whitespace-pre"
              initial={{ y: "-70%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={{ y: "70%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/** 12h | 24h | Ethiopian */
export function TimeFormatSwitch({
  value,
  onChange,
  locale,
  id = "tf",
}: {
  value: TimeFormat;
  onChange: (f: TimeFormat) => void;
  locale: Locale;
  id?: string;
}) {
  const opts: { v: TimeFormat; label: string; am?: boolean }[] = [
    { v: "12h", label: t(locale, "tf12") },
    { v: "24h", label: t(locale, "tf24") },
    { v: "eth", label: t(locale, "tfEth"), am: true },
  ];
  return (
    <div role="radiogroup" aria-label={t(locale, "timeFormat")} className="inline-flex rounded-full bg-ink/[0.05] p-0.5">
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <motion.button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.v)}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
            className={`relative min-h-9 rounded-full px-3 text-xs font-semibold transition-colors ${
              active ? "text-ink" : "text-muted hover:text-ink"
            } ${o.am || locale === "am" ? "am leading-normal" : ""}`}
          >
            {active && (
              <motion.span
                layoutId={`${id}-pill`}
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

/** Progress bar that fills smoothly with a spring. */
export function FillBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`block h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,white)] ${className}`}>
      <motion.span
        className="block h-full rounded-full bg-accent"
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(value * 1000) / 10}%` }}
        transition={{ type: "spring", stiffness: 60, damping: 18 }}
      />
    </span>
  );
}

/** Soft pulsing "LIVE" dot. */
export function LiveDot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold tracking-wider text-bad">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-bad opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-bad" />
      </span>
      {label}
    </span>
  );
}
