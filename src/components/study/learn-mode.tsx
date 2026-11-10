"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
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
}: {
  lessonId: string;
  lessonTitle: string;
  sections: LessonSection[];
  lang: Lang;
  locale: Locale;
  hasQuiz: boolean;
  exitHref: string;
  onStartQuiz: () => void;
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

  const part = sections[index];
  const isLast = index === total - 1;

  const scrollTop = () => requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

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

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.y) > 60) return;
    if (info.offset.x < -70) next();
    else if (info.offset.x > 70) go(index - 1);
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
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-medium text-muted ${amUi}`}>{ui("partOf", { n: index + 1, t: total })}</p>
        <ol className="flex items-center gap-1.5" aria-label={ui("parts")}>
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
                  className={`grid size-5 place-items-center rounded-full transition-all duration-300 disabled:cursor-default ${
                    current
                      ? "bg-accent text-white ring-4 ring-accent/15"
                      : done
                        ? "bg-accent-soft text-accent-ink"
                        : "bg-line text-transparent"
                  }`}
                >
                  {done && !current && <Check className="size-3" strokeWidth={3} aria-hidden />}
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
            drag={touch ? "x" : false}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
            className="touch-pan-y"
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
