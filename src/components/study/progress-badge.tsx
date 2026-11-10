"use client";

import { motion } from "framer-motion";
import { CircleCheck, Trophy } from "lucide-react";
import { percentOf, useLessonProgress, useLessonsProgress } from "@/lib/progress";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";

/** Thin bar that fills smoothly (spring) from 0 when it first appears. */
export function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <span
      className={`block h-1.5 overflow-hidden rounded-full bg-line ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <motion.span
        className={`block h-full rounded-full ${percent >= 100 ? "bg-good" : "bg-accent"}`}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ type: "spring", stiffness: 70, damping: 20, delay: 0.15 }}
      />
    </span>
  );
}

/**
 * Lesson card: bar + "22%" while in progress; green ✓ "Completed" (+ best quiz score) at 100%.
 * Nothing at all when the lesson hasn't been started.
 */
export function LessonProgressBadge({ lessonId, total, locale }: { lessonId: string; total: number; locale: Locale }) {
  const [p] = useLessonProgress(lessonId);
  const pct = percentOf(p, total);
  const best = p.bestScore !== null && p.bestTotal ? t(locale, "bestShort", { s: p.bestScore, t: p.bestTotal }) : null;

  if (pct >= 100)
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-1 font-medium text-good">
          <CircleCheck className="size-3.5" aria-hidden />
          {t(locale, "completed")}
        </span>
        {best && (
          <span className="inline-flex items-center gap-1 text-tip">
            <Trophy className="size-3.5" aria-hidden />
            {best}
          </span>
        )}
      </span>
    );
  if (pct <= 0) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <ProgressBar percent={pct} className="w-20 sm:w-28" />
      <span className="font-semibold text-accent-ink tabular-nums">{pct}%</span>
    </span>
  );
}

/** Unit card: average progress of its lessons, e.g. "41% complete". Nothing at 0%. */
export function UnitProgress({ lessons, locale }: { lessons: { id: string; parts: number }[]; locale: Locale }) {
  const all = useLessonsProgress(lessons.map((l) => l.id));
  if (!lessons.length) return null;
  const pct = Math.round(all.reduce((sum, p, i) => sum + percentOf(p, lessons[i].parts), 0) / lessons.length);
  if (pct <= 0) return null;
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className={`font-semibold tabular-nums ${pct >= 100 ? "text-good" : "text-accent-ink"} ${locale === "am" ? "am" : ""}`}>
          {pct >= 100 ? (
            <span className="inline-flex items-center gap-1">
              <CircleCheck className="size-3.5" aria-hidden />
              {t(locale, "completed")}
            </span>
          ) : (
            t(locale, "percentComplete", { p: pct })
          )}
        </span>
      </div>
      <ProgressBar percent={pct} />
    </div>
  );
}
