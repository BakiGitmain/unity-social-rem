"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { Lang, LessonSection } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import { readLessonProgress, useLessonProgress } from "@/lib/progress";
import { NoteBlock } from "@/components/study/blocks";
import { SectionIcon } from "@/components/study/section-icon";
import { BiText } from "@/components/study/text";
import { FinishedScreen } from "@/components/study/celebration";

const slide = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
};

/**
 * Learn mode: one concept per screen with a progress bar, Next/Back, swipe on touch screens and saved
 * progress. After the last part a "Lesson complete!" screen offers Start Quiz or Exit.
 */
export function LearnMode({
  lessonId,
  lessonTitle,
  sections,
  lang,
  locale,
  hasQuiz,
  exitHref,
  onStartQuiz,
  onPartChange,
  onFinishedChange,
}: {
  lessonId: string;
  lessonTitle: string;
  sections: LessonSection[];
  lang: Lang;
  locale: Locale;
  hasQuiz: boolean;
  exitHref: string;
  onStartQuiz: () => void;
  /** For the AI tutor: which part is on screen, and whether the finished screen shows. */
  onPartChange?: (index: number) => void;
  onFinishedChange?: (finished: boolean) => void;
}) {
  const total = sections.length;
  const [progress, update] = useLessonProgress(lessonId);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [finished, setFinished] = useState(false);
  const [touch, setTouch] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const resumed = useRef(false);

  const ui = (k: Parameters<typeof t>[1], v?: Record<string, string | number>) => t(locale, k, v);
  const amUi = locale === "am" ? "am" : "";

  // Resume where the student left off (once, on mount).
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    const saved = readLessonProgress(lessonId);
    if (!saved.complete && saved.part > 0 && saved.part < total) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex(saved.part);
    }
  }, [lessonId, total]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => onPartChange?.(index), [index, onPartChange]);
  useEffect(() => onFinishedChange?.(finished), [finished, onFinishedChange]);
  useEffect(() => () => onFinishedChange?.(false), [onFinishedChange]);

  const part = sections[index];
  const isLast = index === total - 1;
  const many = total > 8;

  /** Back to the top of the part: VERTICAL only (scrollIntoView could also shift the page sideways). */
  const scrollTop = () =>
    requestAnimationFrame(() => {
      const el = topRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 160; // = scroll-mt-40 (below the sticky header)
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (top < window.scrollY) window.scrollTo({ top: Math.max(0, top), left: window.scrollX, behavior: reduce ? "auto" : "smooth" });
    });

  const go = (to: number) => {
    if (to < 0 || to >= total) return;
    setDir(to > index ? 1 : -1);
    setIndex(to);
    update((p) => ({ ...p, part: to, total }));
    scrollTop();
  };

  const next = () => {
    update((p) => ({
      ...p,
      total,
      done: p.done.includes(index) ? p.done : [...p.done, index],
      part: isLast ? 0 : index + 1,
      complete: p.complete || isLast,
    }));
    if (isLast) {
      setFinished(true);
      scrollTop();
    } else go(index + 1);
  };

  /*
   * Swipe (touch only). Plain touch events, NOT a drag gesture: a drag sets user-select: none and steals
   * long-presses, which broke text selection ("Explain further") on phones. A touch never swipes when
   * text is selected, when it is a long press, or when it starts on something interactive.
   */
  const swipe = useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null);
  const hasSelection = () => {
    const sel = window.getSelection();
    return !!sel && !sel.isCollapsed && sel.toString().trim().length > 0;
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return (swipe.current = null), undefined;
    const tch = e.touches[0]!;
    const target = e.target as Element;
    swipe.current = {
      x: tch.clientX,
      y: tch.clientY,
      t: e.timeStamp,
      skip: hasSelection() || !!target.closest("button, a, input, textarea, select, svg, canvas, table, .tex-display, [data-no-swipe]"),
    };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = swipe.current;
    swipe.current = null;
    if (!st || st.skip || hasSelection()) return;
    const tch = e.changedTouches[0];
    if (!tch) return;
    const dx = tch.clientX - st.x;
    const dy = tch.clientY - st.y;
    const ms = e.timeStamp - st.t;
    if (ms > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return; // long press / scroll
    if (dx < 0) next();
    else go(index - 1);
  };

  if (finished) {
    return (
      <div ref={topRef} className="scroll-mt-40">
        <FinishedScreen
          am={locale === "am"}
          title={ui("lessonComplete")}
          lessonTitle={lessonTitle}
          summary={ui("finishedParts", { n: total })}
          best={
            progress.bestScore !== null && progress.bestTotal
              ? ui("bestScore", { s: progress.bestScore, t: progress.bestTotal })
              : null
          }
          startLabel={ui("startQuiz")}
          exitLabel={ui("exit")}
          exitHref={exitHref}
          hasQuiz={hasQuiz}
          onStartQuiz={onStartQuiz}
        />
      </div>
    );
  }

  if (!part) return null;

  return (
    <div ref={topRef} className="mx-auto max-w-[65ch] scroll-mt-40">
      {/* Progress: "Part 2 of 6" + steps with a checkmark for each finished part */}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className={`shrink-0 text-sm font-medium text-muted ${amUi}`}>{ui("partOf", { n: index + 1, t: total })}</p>
        {/* many parts (e.g. 15): smaller dots, and the row scrolls instead of overflowing the screen */}
        <ol className={`flex min-w-0 items-center overflow-x-auto p-1 [scrollbar-width:none] ${many ? "gap-1" : "gap-1.5"}`} aria-label={ui("parts")}>
          {sections.map((s, i) => {
            const done = progress.done.includes(i);
            const current = i === index;
            const reachable = done || i <= Math.max(index, ...progress.done.map((d) => d + 1));
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => go(i)}
                  aria-label={`${i + 1}`}
                  aria-current={current ? "step" : undefined}
                  className={`grid shrink-0 place-items-center rounded-full transition-all duration-300 disabled:cursor-default ${many ? "size-3.5" : "size-5"} ${
                    current
                      ? `bg-accent text-white ${many ? "ring-2" : "ring-4"} ring-accent/15`
                      : done
                        ? "bg-accent-soft text-accent-ink"
                        : "bg-line text-transparent"
                  }`}
                >
                  {done && !current && !many && <Check className="size-3" strokeWidth={3} aria-hidden />}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${((index + 1) / total) * 100}%` }}
          transition={{ type: "spring", stiffness: 160, damping: 26 }}
        />
      </div>

      {/* The part itself */}
      <div className="relative mt-8 overflow-x-clip">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={part.id}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            onTouchStart={touch ? onTouchStart : undefined}
            onTouchEnd={touch ? onTouchEnd : undefined}
            className="select-text"
          >
            <h2 className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                <SectionIcon name={part.icon} />
              </span>
              <span className={`text-xl leading-snug font-semibold text-ink sm:text-2xl ${lang === "am" ? "am" : ""}`}>
                <BiText value={{ en: part.title_en, am: part.title_am }} lang={lang} single />
              </span>
            </h2>
            <div className="mt-6">
              {part.blocks.map((b, j) => (
                <NoteBlock key={j} block={b} lang={lang} />
              ))}
            </div>
          </motion.section>
        </AnimatePresence>
      </div>

      {/* Back / Next */}
      <div className="mt-10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-3 font-medium text-muted transition-colors hover:text-ink disabled:invisible ${amUi}`}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {ui("back")}
        </button>
        <motion.button
          type="button"
          onClick={next}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 600, damping: 30 }}
          className={`inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-white ${amUi}`}
        >
          {isLast ? ui("finishLesson") : ui("next")}
          {isLast ? <Check className="size-4" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
        </motion.button>
      </div>
      {touch && index === 0 && <p className={`mt-6 text-center text-xs text-faint ${amUi}`}>{ui("swipeHint")}</p>}
    </div>
  );
}
