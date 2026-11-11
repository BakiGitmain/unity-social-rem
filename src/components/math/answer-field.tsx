"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Eraser, X } from "lucide-react";
import type { Bi, VennData } from "@/lib/types";
import { checkSetAnswer, canonicalSet, parseSetAnswer } from "@/lib/math/sets";
import { checkNumberAnswer, evaluate } from "@/lib/math/calc";
import { sameRegions } from "@/lib/math/venn";
import { MathText, texToPlain } from "@/components/math/tex";
import { MathInput } from "@/components/math/math-input";
import { VennDiagram } from "@/components/math/venn-diagram";

/** What the student must give. Choice options are already in the right language. */
export type FieldSpec =
  | { kind: "choice"; options: string[]; correct: number }
  | { kind: "number"; value: number }
  | { kind: "set"; value: string[] }
  | { kind: "venn"; venn: VennData; regions: string[] };

/** A finished answer: `value` is what the server stores (option index, number, canonical set or regions). */
export type FieldResult = { correct: boolean; input: string; chosen: number | null; value: number | string[] | null };

const spring = { type: "spring", stiffness: 500, damping: 32 } as const;

/** Display a stored answer as text (review screens). */
export function describeAnswer(spec: FieldSpec, r: Pick<FieldResult, "input" | "chosen" | "value"> | null): string {
  if (!r) return "—";
  if (spec.kind === "choice") return r.chosen === null ? "—" : (spec.options[r.chosen] ?? "—");
  if (spec.kind === "venn") return Array.isArray(r.value) && r.value.length ? r.value.join(", ") : "nothing shaded";
  return r.input || "—";
}

export function correctAnswerText(spec: FieldSpec): string {
  if (spec.kind === "choice") return spec.options[spec.correct] ?? "";
  if (spec.kind === "number") return String(spec.value);
  if (spec.kind === "set") return spec.value.length ? `{${spec.value.join(", ")}}` : "∅";
  return spec.regions.join(", ");
}

/**
 * One answer box with its own Check button: multiple choice, number, set (friendly feedback) or
 * "shade the Venn diagram". A small celebration on a correct answer, a gentle shake on a wrong one.
 * `locked` = answered for good (quiz): no retry.
 */
/**
 * Multiple choice or "shade the Venn diagram" for one part. (Written set / number answers live in
 * components/questions/written-answer.tsx: one area for the whole question.)
 */
export function AnswerField({
  spec,
  label,
  initial,
  onResult,
  oneShot = false,
  checkLabel = "Check",
}: {
  /** Kept for callers; choice/venn answers have no paper. */
  paperKey?: string;
  spec: FieldSpec;
  label?: Bi | string;
  initial?: FieldResult | null;
  onResult: (r: FieldResult) => void;
  /** Quiz: one attempt only. Homework: try again as often as you like. */
  oneShot?: boolean;
  checkLabel?: string;
}) {
  const [input, setInput] = useState(initial?.input ?? "");
  const [regions, setRegions] = useState<string[]>(spec.kind === "venn" && Array.isArray(initial?.value) ? (initial.value as string[]) : []);
  const [result, setResult] = useState<{ correct: boolean; message: string } | null>(
    initial ? { correct: initial.correct, message: initial.correct ? "Correct!" : "" } : null,
  );
  const [shake, setShake] = useState(0);
  const [party, setParty] = useState(0);
  const locked = oneShot && result !== null;

  const finish = (correct: boolean, message: string, r: Omit<FieldResult, "correct">) => {
    setResult({ correct, message });
    if (correct) setParty((n) => n + 1);
    else setShake((n) => n + 1);
    onResult({ correct, ...r });
  };

  const check = () => {
    if (locked) return;
    if (spec.kind === "number") {
      const c = checkNumberAnswer(input, spec.value);
      if (!input.trim()) return setResult({ correct: false, message: c.message });
      let v: number | null = null;
      try {
        v = evaluate(input);
      } catch {}
      if (v === null && !c.correct) return setResult({ correct: false, message: c.message }); // can't read it: no attempt used
      finish(c.correct, c.message, { input, chosen: null, value: v });
    } else if (spec.kind === "set") {
      const c = checkSetAnswer(input, spec.value);
      if (c.error) return setResult({ correct: false, message: c.message });
      const parsed = parseSetAnswer(input);
      finish(c.correct, c.message, { input, chosen: null, value: parsed.ok ? canonicalSet(parsed.elements) : [] });
    } else if (spec.kind === "venn") {
      const ok = sameRegions(regions, spec.regions);
      const missing = spec.regions.filter((r) => !regions.includes(r)).length;
      const extra = regions.filter((r) => !spec.regions.includes(r)).length;
      const message = ok
        ? "Correct!"
        : !regions.length
          ? "Tap the regions to shade them first."
          : missing && extra
            ? `Not yet: ${missing} region${missing > 1 ? "s" : ""} missing and ${extra} extra.`
            : missing
              ? `Almost! ${missing} more region${missing > 1 ? "s" : ""} to shade.`
              : `Almost! ${extra} region${extra > 1 ? "s" : ""} should not be shaded.`;
      if (!regions.length) return setResult({ correct: false, message });
      finish(ok, message, { input: regions.join(","), chosen: null, value: [...regions].sort() });
    }
  };

  const choose = (i: number) => {
    if (locked || spec.kind !== "choice") return;
    const ok = i === spec.correct;
    finish(ok, ok ? "Correct!" : "Not quite.", { input: spec.options[i] ?? "", chosen: i, value: null });
  };

  const labelText = typeof label === "string" ? label : label?.en;
  const good = result?.correct === true;
  const bad = result !== null && !result.correct && (spec.kind === "choice" || shake > 0);

  return (
    <div className="relative">
      {labelText && (
        <p className="mb-2 text-[15px] font-medium text-ink">
          <MathText text={labelText} />
        </p>
      )}

      {spec.kind === "choice" && (
        <ChoiceList
          options={spec.options}
          correct={spec.correct}
          picked={initial?.chosen ?? null}
          locked={locked}
          revealCorrect={oneShot}
          onPick={choose}
        />
      )}

      {(spec.kind === "number" || spec.kind === "set") && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <MathInput
              value={input}
              onChange={(v) => {
                setInput(v);
                if (result && !result.correct && !locked) setResult(null);
              }}
              onEnter={check}
              disabled={locked}
              ariaLabel={labelText ? labelText.replace(/\$/g, "") : "Your answer"}
              placeholder={spec.kind === "set" ? "e.g. {1, 2, 3}  or  ∅" : "Type a number"}
              state={good ? "good" : bad ? "bad" : "idle"}
              shakeKey={shake}
            />
          </div>
          {!locked && (
            <button type="button" onClick={check} className="h-12 shrink-0 rounded-2xl bg-accent px-6 font-medium text-white transition-transform active:scale-95">
              {checkLabel}
            </button>
          )}
        </div>
      )}

      {spec.kind === "venn" && (
        <VennShade
          spec={spec}
          regions={regions}
          setRegions={(r) => {
            setRegions(r);
            if (result && !result.correct && !locked) setResult(null);
          }}
          locked={locked}
          tone={good ? "good" : bad && locked ? "bad" : "accent"}
          shake={shake}
          onCheck={check}
          checkLabel={checkLabel}
        />
      )}

      {/* feedback */}
      <AnimatePresence initial={false}>
        {result && result.message && (spec.kind !== "choice" || !oneShot) && (
          <motion.p
            key={result.message + shake + party}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring}
            role="status"
            className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${result.correct ? "text-good" : "text-bad"}`}
          >
            {result.correct ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
            <MathText text={result.message} />
          </motion.p>
        )}
      </AnimatePresence>

      <Celebrate trigger={party} />
    </div>
  );
}

/* ------------------------------------------------------------------ multiple choice */

export function ChoiceList({
  options,
  correct,
  picked,
  locked,
  revealCorrect,
  onPick,
}: {
  options: string[];
  correct: number;
  picked: number | null;
  locked: boolean;
  revealCorrect: boolean;
  onPick: (i: number) => void;
}) {
  const [chosen, setChosen] = useState<number | null>(picked);
  const answered = chosen !== null && (locked || chosen === correct || !revealCorrect);
  return (
    <ul className="space-y-2.5">
      {options.map((opt, i) => {
        const isCorrect = i === correct;
        const isChosen = i === chosen;
        const showGood = answered && isCorrect && (revealCorrect || isChosen);
        const showBad = answered && isChosen && !isCorrect;
        let state = "border-line bg-surface hover:border-[color:var(--accent)] hover:bg-[var(--accent-tint)]";
        if (showGood) state = "border-good bg-good-soft";
        else if (showBad) state = "border-bad bg-bad-soft";
        else if (locked) state = "border-line bg-surface opacity-60";
        return (
          <li key={i}>
            <motion.button
              type="button"
              disabled={locked}
              onClick={() => {
                setChosen(i);
                onPick(i);
              }}
              animate={showBad ? { x: [0, -6, 6, -4, 4, 0] } : showGood && isChosen ? { scale: [1, 1.015, 1] } : {}}
              transition={{ duration: 0.4 }}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${state}`}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold ${
                  showGood ? "bg-good text-white" : showBad ? "bg-bad text-white" : "bg-paper text-muted"
                }`}
              >
                {showGood ? <Check className="size-4" aria-hidden /> : showBad ? <X className="size-4" aria-hidden /> : String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0 text-ink">
                <MathText text={opt} />
              </span>
            </motion.button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ shade the Venn diagram */

function VennShade({
  spec,
  regions,
  setRegions,
  locked,
  tone,
  shake,
  onCheck,
  checkLabel,
}: {
  spec: Extract<FieldSpec, { kind: "venn" }>;
  regions: string[];
  setRegions: (r: string[]) => void;
  locked: boolean;
  tone: "accent" | "good" | "bad";
  shake: number;
  onCheck: () => void;
  checkLabel: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!shake || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }, [shake]);

  return (
    <div>
      <div ref={box} className="flex justify-center rounded-2xl bg-surface p-3 ring-1 ring-line">
        <VennDiagram
          venn={spec.venn}
          shaded={regions}
          mode={locked ? "view" : "answer"}
          tone={tone}
          showElements={!!spec.venn.elements}
          ariaLabel="Tap the regions to shade them"
          onRegion={(r) => setRegions(regions.includes(r) ? regions.filter((x) => x !== r) : [...regions, r])}
        />
      </div>
      {!locked && (
        <div className="mt-2 flex items-center gap-2">
          <p className="mr-auto text-xs text-faint">Tap a region to shade it, tap again to clear it.</p>
          <button
            type="button"
            onClick={() => setRegions([])}
            disabled={!regions.length}
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm text-muted hover:bg-ink/[0.05] disabled:opacity-40"
          >
            <Eraser className="size-4" aria-hidden /> Clear
          </button>
          <button type="button" onClick={onCheck} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition-transform active:scale-95">
            {checkLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ celebration */

const COLORS = ["#0f766e", "#f59e0b", "#3d6a91", "#15803d", "#e11d48", "#0ea5e9"];

/** A small, quick burst of confetti dots (skipped for reduced motion). */
export function Celebrate({ trigger }: { trigger: number }) {
  // Each new trigger re-keys the dots, which fly out and fade (motion-reduce: hidden).
  const burst = trigger;
  if (!burst) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex justify-center motion-reduce:hidden" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const d = 60 + (i % 3) * 22;
        return (
          <motion.span
            key={`${burst}-${i}`}
            className="absolute size-2 rounded-full"
            style={{ background: COLORS[i % COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d - 20, opacity: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        );
      })}
    </div>
  );
}
