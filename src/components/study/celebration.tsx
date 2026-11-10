"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Target, Trophy } from "lucide-react";
import { usePinBar } from "@/lib/bar-pin";

const COLORS = ["#0f766e", "#f6c76b", "#2563c9", "#c0620e", "#15803d", "#5bb37b"];

/** "Lesson complete!": a springy, self-drawing checkmark, the summary and two clear actions. */
export function FinishedScreen({
  am,
  title,
  lessonTitle,
  summary,
  best,
  startLabel,
  exitLabel,
  exitHref,
  hasQuiz,
  onStartQuiz,
}: {
  am: boolean;
  title: string;
  lessonTitle: string;
  summary: string;
  best: string | null;
  startLabel: string;
  exitLabel: string;
  exitHref: string;
  hasQuiz: boolean;
  onStartQuiz: () => void;
}) {
  const reduce = useReducedMotion();
  usePinBar(true); // keep the mobile tab bar visible on this screen
  const dots = reduce ? [] : Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className={`mx-auto flex max-w-md flex-col items-center py-8 text-center sm:py-12 ${am ? "am" : ""}`}>
      <div className="relative grid size-32 place-items-center">
        {dots.map((i) => {
          const angle = (i / dots.length) * Math.PI * 2 - Math.PI / 2;
          const dist = 70 + (i % 2) * 10;
          return (
            <motion.span
              key={i}
              className="absolute size-2 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
              animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: [0, 1, 0], scale: [0.3, 1, 0.5] }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
            />
          );
        })}
        <motion.svg
          viewBox="0 0 96 96"
          className="size-28"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          aria-hidden
        >
          <motion.circle
            cx="48"
            cy="48"
            r="44"
            fill="var(--good-soft)"
            stroke="var(--good)"
            strokeWidth="4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path
            d="M29 49.5 L42.5 63 L67 36"
            fill="none"
            stroke="var(--good)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.35 }}
          />
        </motion.svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.25 }}
      >
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h2>
        <p className="mt-1.5 font-medium text-ink/80">{lessonTitle}</p>
        <p className="mt-1 text-muted">{summary}</p>
        {best && (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-tip-soft px-3.5 py-1.5 text-sm font-medium text-tip">
            <Trophy className="size-4" aria-hidden />
            {best}
          </p>
        )}
      </motion.div>

      <motion.div
        className="mt-8 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.4 }}
      >
        {hasQuiz && (
          <motion.button
            type="button"
            onClick={onStartQuiz}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 font-medium text-white sm:min-w-44"
          >
            <Target className="size-4" aria-hidden />
            {startLabel}
          </motion.button>
        )}
        <Link
          href={exitHref}
          className="inline-flex items-center justify-center rounded-full bg-surface px-7 py-3 font-medium text-ink ring-1 ring-line transition-colors hover:bg-paper sm:min-w-32"
        >
          {exitLabel}
        </Link>
      </motion.div>
    </div>
  );
}
