"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator as CalcIcon, Check, Eraser, Eye, Lightbulb, LifeBuoy, NotebookPen, X } from "lucide-react";
import type { Lang } from "@/lib/types";
import type { UQuestion } from "@/lib/questions";
import { sameRegions } from "@/lib/math/venn";
import { BiText } from "@/components/study/text";
import { MathText } from "@/components/math/tex";
import { AnswerField, Celebrate, type FieldResult } from "@/components/math/answer-field";
import { VennDiagram } from "@/components/math/venn-diagram";
import { WorkedExample } from "@/components/math/worked-example";
import { Calculator } from "@/components/math/calculator";
import { ScratchPaper } from "@/components/ink/scratch-paper";
import { WrittenAnswer } from "@/components/questions/written-answer";
import { VennBlock } from "@/components/math/venn-block";
import { evalVenn } from "@/lib/math/venn";
import type { VennData } from "@/lib/types";

function shadeOf(expr: string, venn: VennData): string[] {
  try {
    return evalVenn(expr, venn.sets, venn.labels ?? ["A", "B", "C"].slice(0, venn.sets));
  } catch {
    return [];
  }
}

const spring = { type: "spring", stiffness: 420, damping: 36 } as const;

/**
 * ONE question card, used by Homework, Extra practice and the Quiz.
 * The whole question, then ONE answer area by type: choice (tap) · written (one paper / one set of labelled
 * lines, one Check) · venn (shade the diagrams, one Check). Calculation paper + calculator inside the card.
 * Practice: Tip → hints → full solution. Quiz: one attempt; explanation + steps after answering.
 */
export function QuestionCard({
  q,
  kicker,
  lang,
  paperKey,
  saved = {},
  onPart,
  mode = "practice",
  checkLabel = "Check",
  after,
}: {
  q: UQuestion;
  kicker: string;
  lang: Lang;
  paperKey: string;
  saved?: Record<number, FieldResult | undefined>;
  onPart: (j: number, r: FieldResult) => void;
  mode?: "practice" | "quiz";
  checkLabel?: string;
  /** Quiz: shown once the question is answered (result + Next). */
  after?: React.ReactNode;
}) {
  const quiz = mode === "quiz";
  const [tip, setTip] = useState(false);
  const [hints, setHints] = useState(0);
  const [solution, setSolution] = useState(false);
  const [paper, setPaper] = useState(false);
  const [calc, setCalc] = useState(false);
  const answered = q.parts.length > 0 && q.parts.every((_, j) => saved[j]);
  const am = lang === "am";
  const pill = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors";

  return (
    <article className={`rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-7 ${am ? "am" : ""}`}>
      <p className="text-xs font-semibold tracking-wide text-accent-ink uppercase">{kicker}</p>
      <h2 className="mt-1.5 text-[17px] leading-relaxed font-medium text-ink sm:text-lg">
        <BiText value={q.text} lang={lang} />
      </h2>

      {/* the numbered drawing from class: tap a region to see its number */}
      {q.figure && <VennBlock block={{ type: "venn", venn: q.figure.venn, showElements: true, caption: q.figure.caption }} lang={lang} />}

      {/* ONE answer area */}
      <div className="mt-5">
        {q.type === "choice" && (
          <div className="space-y-5">
            {q.parts.map((p, j) => (
              <AnswerField
                key={j}
                spec={p.spec}
                label={q.parts.length > 1 ? p.label : undefined}
                initial={saved[j] ?? null}
                oneShot={quiz}
                onResult={(r) => onPart(j, r)}
                paperKey={`${paperKey}:${j}`}
              />
            ))}
          </div>
        )}
        {q.type === "written" && <WrittenAnswer title={<BiText value={q.text} lang={lang} />} parts={q.parts} paperKey={paperKey} saved={saved} oneShot={quiz} onPart={onPart} checkLabel={checkLabel} />}
        {q.type === "venn" && <VennAnswer q={q} saved={saved} oneShot={quiz} onPart={onPart} checkLabel={checkLabel} onChecked={() => !quiz && setSolution(true)} />}
        {q.type === "open" && <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-muted ring-1 ring-line">Work it out on the calculation paper, then compare with the full solution.</p>}
      </div>

      {/* after Check: left side and right side shaded side by side, so the student SEES they match */}
      <AnimatePresence initial={false}>
        {q.compare && q.figure && q.parts.length > 0 && q.parts.every((_, j) => saved[j]) && (
          <Reveal key="compare">
            <div className="mt-4 grid gap-3 rounded-2xl bg-paper p-3 ring-1 ring-line sm:grid-cols-2">
              {q.compare.map((c, i) => (
                <figure key={i} className="rounded-xl bg-surface p-2 ring-1 ring-line">
                  <figcaption className="mb-1 text-center text-sm font-medium text-ink">
                    <BiText value={c.label} lang={lang} single />
                  </figcaption>
                  <div className="flex justify-center">
                    <VennDiagram venn={q.figure!.venn} shaded={shadeOf(c.shade, q.figure!.venn)} showElements />
                  </div>
                </figure>
              ))}
            </div>
          </Reveal>
        )}
      </AnimatePresence>

      {/* tools: calculation paper (never sent to the AI) + calculator: only where calculating / drawing helps */}
      {q.needsCalc && (
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
        <button type="button" onClick={() => setPaper(true)} className={`${pill} justify-center bg-ink/[0.05] text-ink hover:bg-ink/[0.08]`}>
          <NotebookPen className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            <span className="sm:hidden">Calc. paper</span>
            <span className="hidden sm:inline">Open calculation paper</span>
          </span>
        </button>
        <button type="button" onClick={() => setCalc(true)} className={`${pill} justify-center bg-accent-soft text-accent-ink hover:bg-accent/15`}>
          <CalcIcon className="size-4 shrink-0" aria-hidden /> Calculator
        </button>
      </div>
      )}

      {/* help: practice = any time; quiz = after answering */}
      {!quiz && (q.tip || q.hints?.length || q.solution) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          {q.tip && (
            <button type="button" onClick={() => setTip((t) => !t)} aria-expanded={tip} className={`${pill} ${tip ? "bg-tip text-white" : "bg-tip-soft text-tip"}`}>
              <Lightbulb className="size-4" aria-hidden /> Tip
            </button>
          )}
          {!!q.hints?.length && hints < q.hints.length && (
            <button type="button" onClick={() => setHints((h) => h + 1)} className={`${pill} bg-note-soft text-note`}>
              <LifeBuoy className="size-4" aria-hidden /> {hints === 0 ? "I'm stuck" : `Hint ${hints + 1}`}
            </button>
          )}
          {q.solution && !solution && (
            <button type="button" onClick={() => setSolution(true)} className={`${pill} bg-ink/[0.05] text-muted hover:text-ink`}>
              <Eye className="size-4" aria-hidden /> Show full solution
            </button>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {tip && q.tip && (
          <Reveal key="tip">
            <p className="mt-3 rounded-2xl bg-tip-soft px-4 py-3 text-[15px] leading-relaxed text-ink">
              <span className="font-semibold text-tip">Tip: </span>
              <BiText value={q.tip} lang={lang} />
            </p>
          </Reveal>
        )}
        {q.hints?.slice(0, hints).map((h, i) => (
          <Reveal key={`h${i}`}>
            <p className="mt-3 rounded-2xl bg-note-soft px-4 py-3 text-[15px] leading-relaxed text-ink">
              <span className="font-semibold text-note">Hint {i + 1}: </span>
              <BiText value={h} lang={lang} />
            </p>
          </Reveal>
        ))}
        {solution && q.solution && (
          <Reveal key="solution">
            <WorkedExample title={{ en: "Full solution", am: "ሙሉ መፍትሔ" }} steps={q.solution.steps} answer={q.solution.answer} venn={q.solution.venn} lang={lang} />
          </Reveal>
        )}
        {quiz && answered && (
          <Reveal key="after">
            <QuizExplanation q={q} lang={lang} right={q.parts.every((_, j) => saved[j]?.correct)} />
            {after}
          </Reveal>
        )}
      </AnimatePresence>

      <AnimatePresence>{calc && <Calculator key="calc" onClose={() => setCalc(false)} />}</AnimatePresence>
      <AnimatePresence>{paper && <ScratchPaper key="paper" id={paperKey} onClose={() => setPaper(false)} />}</AnimatePresence>
    </article>
  );
}

function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
      {children}
    </motion.div>
  );
}

function QuizExplanation({ q, lang, right }: { q: UQuestion; lang: Lang; right: boolean }) {
  const am = lang === "am";
  return (
    <div className={`mt-5 rounded-2xl px-4 py-3.5 ${right ? "bg-good-soft" : "bg-bad-soft"}`} role="status" aria-live="polite">
      <p className={`flex items-center gap-2 font-semibold ${right ? "text-good" : "text-bad"}`}>
        {right ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
        {right ? (am ? "ትክክል!" : "Correct!") : am ? "ትክክል አይደለም" : "Not quite"}
      </p>
      {q.explanation && (
        <p className="mt-1.5 text-sm leading-relaxed text-ink/90">
          <MathText text={am ? q.explanation.am : q.explanation.en} />
        </p>
      )}
      {!!q.steps?.length && (
        <ol className="font-hand mt-3 space-y-1 rounded-xl bg-white/70 px-4 py-2.5 text-[16px] leading-7 text-[#23324a]">
          {q.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 text-[#c05050]/80">{i + 1}.</span>
              <span className="min-w-0">
                <MathText text={am ? s.text.am : s.text.en} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Venn / "show that": shade mode, one Check */

function VennAnswer({
  q,
  saved,
  oneShot,
  onPart,
  checkLabel,
  onChecked,
}: {
  q: UQuestion;
  saved: Record<number, FieldResult | undefined>;
  oneShot: boolean;
  onPart: (j: number, r: FieldResult) => void;
  checkLabel: string;
  onChecked: () => void;
}) {
  const parts = q.parts.filter((p) => p.spec.kind === "venn");
  const [shaded, setShaded] = useState<string[][]>(() => q.parts.map((_, j) => (Array.isArray(saved[j]?.value) ? (saved[j]!.value as string[]) : [])));
  const [res, setRes] = useState<(boolean | null)[]>(() => q.parts.map((_, j) => saved[j]?.correct ?? null));
  const [msg, setMsg] = useState<string | null>(null);
  const [party, setParty] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const [shake, setShake] = useState(0);
  const locked = oneShot && res.every((r) => r !== null);

  useEffect(() => {
    const el = box.current;
    if (!shake || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }, [shake]);

  const check = () => {
    if (shaded.every((s) => !s.length)) return setMsg("Tap the regions to shade them first.");
    const next = q.parts.map((p, j) => (p.spec.kind === "venn" ? sameRegions(shaded[j] ?? [], p.spec.regions) : null));
    setRes(next);
    q.parts.forEach((p, j) => {
      if (p.spec.kind !== "venn") return;
      onPart(j, { correct: !!next[j], input: (shaded[j] ?? []).join(","), chosen: null, value: [...(shaded[j] ?? [])].sort() });
    });
    const ok = next.filter(Boolean).length;
    setMsg(ok === parts.length ? "Correct! Every region is right." : parts.length > 1 ? `${ok} / ${parts.length} diagrams correct.` : "Not yet: compare with the regions in the solution.");
    if (ok === parts.length) setParty((n) => n + 1);
    else setShake((n) => n + 1);
    onChecked();
  };

  return (
    <div className="relative">
      <div ref={box} className={`ink-paper grid gap-3 rounded-2xl p-3 ring-1 ring-line ${parts.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {q.parts.map((p, j) =>
          p.spec.kind === "venn" ? (
            <div key={j} className={`rounded-xl bg-white/70 p-2 ${res[j] === true ? "ring-2 ring-good" : res[j] === false ? "ring-2 ring-bad/60" : ""}`}>
              {p.label && (
                <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink">
                  {res[j] === true && <Check className="size-4 text-good" aria-label="correct" />}
                  {res[j] === false && <X className="size-4 text-bad" aria-label="wrong" />}
                  <MathText text={p.label} />
                </p>
              )}
              <div className="flex justify-center">
                <VennDiagram
                  venn={p.spec.venn}
                  shaded={shaded[j] ?? []}
                  mode={locked ? "view" : "answer"}
                  tone={res[j] === true ? "good" : "accent"}
                  showElements={!!p.spec.venn.elements}
                  ariaLabel="Tap the regions to shade them"
                  onRegion={(r) => {
                    setShaded((all) => all.map((s, k) => (k === j ? (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]) : s)));
                    if (!oneShot) setRes((rs) => rs.map((x, k) => (k === j ? null : x)));
                  }}
                />
              </div>
            </div>
          ) : null,
        )}
      </div>
      {!locked && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-auto text-xs text-faint">Shade mode: tap a region to shade it, tap again to clear it.</span>
          <button
            type="button"
            onClick={() => (setShaded(q.parts.map(() => [])), setRes(q.parts.map(() => null)), setMsg(null))}
            className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm text-muted hover:bg-ink/[0.05]"
          >
            <Eraser className="size-4" aria-hidden /> Clear
          </button>
          <button type="button" onClick={check} className="h-11 rounded-full bg-accent px-6 font-medium text-white transition-transform active:scale-95">
            {checkLabel}
          </button>
        </div>
      )}
      {msg && <p className={`mt-2 text-sm font-medium ${res.every((r) => r !== false) && res.some((r) => r) ? "text-good" : "text-bad"}`}>{msg}</p>}
      <Celebrate trigger={party} />
    </div>
  );
}
