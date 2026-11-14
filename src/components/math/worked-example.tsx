"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, HelpCircle, ListChecks, RotateCcw } from "lucide-react";
import type { Bi, Guide, Lang, VennData, WorkedStep } from "@/lib/types";
import { evalVenn } from "@/lib/math/venn";
import { BiText } from "@/components/study/text";
import { VennDiagram } from "@/components/math/venn-diagram";
import { GuideIntro, GuideOutro, SECTION, SectionHead, SectionIcon, StepBadge } from "@/components/math/solution-guide";

const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

/** Regions shaded after the first `shown` steps (the latest step that has a shade wins). */
function shadeAt(venn: VennData | undefined, steps: WorkedStep[], shown: number): string[] {
  if (!venn) return [];
  for (let i = Math.min(shown, steps.length) - 1; i >= 0; i--) {
    const s = steps[i]?.shade;
    if (s) {
      try {
        return evalVenn(s, venn.sets, venn.labels ?? ["A", "B", "C"].slice(0, venn.sets));
      } catch {
        return [];
      }
    }
  }
  return [];
}

/**
 * Paper-mode worked example: handwritten working on lined paper, revealed one step at a time.
 * Each step has a "Why?" toggle; the final answer is highlighted. An optional Venn diagram
 * beside it follows each step's `shade`.
 */
export function WorkedExample({
  title,
  problem,
  steps,
  answer,
  venn,
  guide,
  lang,
  startOpen = false,
}: {
  title?: Bi;
  problem?: Bi;
  steps: WorkedStep[];
  answer: Bi;
  venn?: VennData;
  /** Teacher-style template: what it asks, what we know, the rule (above) · wrong choices, common mistake (after). */
  guide?: Guide;
  lang: Lang;
  startOpen?: boolean;
}) {
  const [shown, setShown] = useState(startOpen ? steps.length : 1);
  const [why, setWhy] = useState<Set<number>>(new Set());
  const done = shown >= steps.length;

  // Venn follows the latest step that has a shade.
  const shaded = shadeAt(venn, steps, shown);

  const toggleWhy = (i: number) =>
    setWhy((w) => {
      const n = new Set(w);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <figure className="my-6 overflow-hidden rounded-2xl ring-1 ring-line">
      {(
        <div className="bg-surface px-4 py-3 sm:px-5">
          {title && (
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">
              <BiText value={title} lang={lang} single />
            </p>
          )}
          {problem && (
            <p className="mt-1 text-[15px] leading-relaxed">
              <BiText value={problem} lang={lang} />
            </p>
          )}
          <GuideIntro guide={guide} lang={lang} className={title || problem ? "mt-3" : ""} />
          <div className={title || problem || guide ? "mt-3" : ""}>
            <SectionHead kind="steps" lang={lang} />
          </div>
        </div>
      )}

      <div className={`paper-lined px-4 py-4 pl-[3.2rem] sm:px-6 sm:pl-[3.6rem] ${venn ? "md:grid md:grid-cols-[1fr_minmax(0,260px)] md:gap-5" : ""}`}>
        <ol className="font-hand space-y-1 text-[17px] leading-8 text-[#23324a]">
          <AnimatePresence initial={false}>
            {steps.slice(0, shown).map((s, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
                className="relative"
              >
                <span className="absolute top-1 -left-9">
                  <StepBadge n={i + 1} />
                </span>
                <span className="mr-1">
                  <BiText value={s.text} lang={lang} />
                </span>
                {s.why && (
                  <button
                    type="button"
                    onClick={() => toggleWhy(i)}
                    aria-expanded={why.has(i)}
                    className="ml-1 inline-flex translate-y-[-1px] items-center gap-0.5 rounded-full bg-note-soft px-2 align-middle font-sans text-xs font-medium leading-6 text-note"
                  >
                    <HelpCircle className="size-3.5" aria-hidden />
                    Why?
                  </button>
                )}
                <AnimatePresence initial={false}>
                  {s.why && why.has(i) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={spring}
                      className="overflow-hidden"
                    >
                      <p className="my-1 rounded-xl bg-note-soft/90 px-3 py-2 font-sans text-sm leading-relaxed text-ink/85">
                        <BiText value={s.why} lang={lang} />
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {done && (
              <motion.li
                key="answer"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={spring}
                className="relative !mt-3 -ml-9 flex w-fit max-w-full items-start gap-2 rounded-xl px-3 py-1.5"
                style={{ backgroundColor: `${SECTION.answer.color}1a`, boxShadow: `inset 0 0 0 1px ${SECTION.answer.color}40` }}
              >
                <SectionIcon kind="answer" className="mt-0.5" />
                <span className="min-w-0">
                  <span className="font-sans text-[12px] font-semibold tracking-wide uppercase" style={{ color: SECTION.answer.color }}>
                    {lang === "am" ? "መልስ" : "Answer"}
                  </span>
                  <span className="block">
                    <BiText value={answer} lang={lang} />
                  </span>
                </span>
              </motion.li>
            )}
          </AnimatePresence>
        </ol>

        {venn && (
          <div className="mt-4 flex justify-center md:mt-0 md:items-start">
            <div className="w-full max-w-[260px] rounded-xl bg-white/70 p-2">
              <VennDiagram venn={venn} shaded={shaded} />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {done && guide && (guide.wrong?.length || guide.mistake || guide.check) && (
          <motion.div key="outro" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden bg-paper">
            <GuideOutro guide={guide} lang={lang} className="px-4 py-3 sm:px-5" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2 bg-surface px-4 py-3 sm:px-5">
        {!done ? (
          <>
            <button
              type="button"
              onClick={() => setShown((n) => Math.min(steps.length, n + 1))}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              Next step <ChevronRight className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setShown(steps.length)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted hover:bg-ink/[0.05]"
            >
              <ListChecks className="size-4" aria-hidden /> Show all
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShown(1);
              setWhy(new Set());
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted hover:bg-ink/[0.05]"
          >
            <RotateCcw className="size-4" aria-hidden /> Start again
          </button>
        )}
        <span className="ml-auto text-xs text-faint">
          Step {Math.min(shown, steps.length)} of {steps.length}
        </span>
      </div>
    </figure>
  );
}
