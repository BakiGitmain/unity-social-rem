"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import type { HomeworkItem, Lang } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { useHomeworkProgress } from "@/lib/homework-progress";
import { useUser } from "@/components/user-provider";
import { fromHomework } from "@/lib/questions";
import { QuestionCard } from "@/components/questions/question-card";

const spring = { type: "spring", stiffness: 420, damping: 36 } as const;
type List = "homework" | "practice";

/**
 * Homework tab: the teacher's homework (the progress % counts ONLY these) and optional "Extra practice".
 * One exercise at a time, each as ONE question card (the same card as the quiz).
 * Practice progress is saved too, under "p:" keys, so it never counts as homework.
 */
export function Homework({
  lessonId,
  items,
  practice = [],
  lang,
  locale,
}: {
  lessonId: string;
  items: HomeworkItem[];
  practice?: HomeworkItem[];
  lang: Lang;
  locale: Locale;
}) {
  const { username } = useUser();
  const [progress, update] = useHomeworkProgress(lessonId, !!username);
  const [list, setList] = useState<List>(items.length ? "homework" : "practice");
  const [index, setIndex] = useState(0);
  const am = locale === "am";
  const current = list === "homework" ? items : practice;
  const prefix = list === "homework" ? "" : "p:";
  const item = current[Math.min(index, current.length - 1)];
  const key = (id: string) => `${prefix}${id}`;

  const doneIn = (arr: HomeworkItem[], pre: string) => arr.filter((it) => progress.done.includes(`${pre}${it.id}`)).length;
  // Warm-ups are shown first but never counted.
  const counted = items.filter((it) => !it.warmup);
  const hwDone = doneIn(counted, "");
  const pct = counted.length ? Math.round((hwDone / counted.length) * 100) : 0;
  /** Exercise number shown to students (warm-ups: "W"). */
  const numberOf = (arr: HomeworkItem[], i: number) => (arr[i]?.warmup ? "W" : String(arr.slice(0, i + 1).filter((x) => !x.warmup).length));
  const practiceDone = doneIn(practice, "p:");

  const go = (i: number) => {
    setIndex(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const switchList = (l: List) => {
    setList(l);
    setIndex(0);
  };

  if (!item) return null;
  const isDone = progress.done.includes(key(item.id));
  const toggleDone = () =>
    update((p) => ({ ...p, done: isDone ? p.done.filter((d) => d !== key(item.id)) : [...p.done, key(item.id)] }));

  return (
    <div className="mx-auto max-w-2xl">
      {/* Homework | Extra practice */}
      {practice.length > 0 && items.length > 0 && (
        <div role="radiogroup" aria-label="Exercises" className="mb-5 inline-flex rounded-full bg-ink/[0.05] p-1">
          {(
            [
              ["homework", am ? "የቤት ሥራ" : "Homework", `${hwDone}/${counted.length}`],
              ["practice", am ? "ተጨማሪ ልምምድ" : "Extra practice", `${practiceDone}/${practice.length}`],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={list === id}
              onClick={() => switchList(id)}
              className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${list === id ? "text-white" : "text-muted hover:text-ink"} ${am ? "am" : ""}`}
            >
              {list === id && <motion.span layoutId="hw-list-pill" className="absolute inset-0 rounded-full bg-accent" transition={spring} />}
              <span className="relative">
                {label} <span className="tabular-nums opacity-75">· {count}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* progress: homework only */}
      {list === "homework" ? (
        <>
          <div className={`flex items-center justify-between text-sm text-muted ${am ? "am" : ""}`}>
            <span>
              {am ? "የቤት ሥራ" : "Homework"} · {pct}% {am ? "ተጠናቋል" : "done"}
            </span>
            <span className="tabular-nums">
              {item.warmup ? (am ? "ማሟሟቂያ" : "Warm-up") : `${numberOf(items, index)} / ${counted.length}`}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <motion.div className="h-full rounded-full bg-good" initial={false} animate={{ width: `${pct}%` }} transition={spring} />
          </div>
        </>
      ) : (
        <p className={`text-sm text-muted ${am ? "am" : ""}`}>
          {am ? "አማራጭ፦ ለተጨማሪ ልምምድ። በቤት ሥራ መቶኛ ውስጥ አይቆጠርም።" : "Optional, for extra practice. It doesn't count towards your homework %."}
        </p>
      )}

      {/* exercise picker */}
      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={list === "homework" ? "Homework exercises" : "Practice exercises"}>
        {current.map((it, i) => {
          const done = progress.done.includes(key(it.id));
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => go(i)}
              className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors ${
                i === index ? "bg-accent text-white" : done ? "bg-good-soft text-good" : "bg-ink/[0.05] text-muted hover:text-ink"
              }`}
            >
              {done && i !== index ? <CheckCircle2 className="size-4" aria-label={`Exercise ${numberOf(current, i)}, done`} /> : numberOf(current, i)}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${list}:${item.id}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="mt-4" transition={spring}>
          <QuestionCard
            q={fromHomework(item, lang)}
            kicker={
              item.warmup
                ? am
                  ? "ማሟሟቂያ (አይቆጠርም)"
                  : "Warm-up (not counted)"
                : `${list === "homework" ? (am ? "የቤት ሥራ" : "Homework") : am ? "ልምምድ" : "Practice"} ${numberOf(current, index)}`
            }
            lang={lang}
            paperKey={`${list === "homework" ? "hw" : "px"}:${lessonId}:${item.id}`}
            saved={Object.fromEntries(item.answers.map((_, j) => [j, progress.answers[`${key(item.id)}:${j}`]]))}
            onPart={(j, r) =>
              update((p) => ({ ...p, answers: { ...p.answers, [`${key(item.id)}:${j}`]: { input: r.input, correct: r.correct, value: r.value, chosen: r.chosen } } }))
            }
          />
        </motion.div>
      </AnimatePresence>

      {/* done + navigation */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleDone}
          aria-pressed={isDone}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
            isDone ? "bg-good text-white" : "bg-surface text-ink ring-1 ring-line hover:ring-line-strong"
          }`}
        >
          {isDone ? <CheckCircle2 className="size-4" aria-hidden /> : <Circle className="size-4" aria-hidden />}
          {isDone ? "Done" : "Mark as done"}
        </button>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous exercise"
            className="grid size-11 place-items-center rounded-full bg-surface ring-1 ring-line disabled:opacity-40"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === current.length - 1}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Next <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
