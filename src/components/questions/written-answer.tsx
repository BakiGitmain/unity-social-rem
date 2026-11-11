"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Keyboard, Maximize2, PencilLine, ScanText, X } from "lucide-react";
import type { QPart } from "@/lib/questions";
import type { FieldResult } from "@/components/math/answer-field";
import { Celebrate } from "@/components/math/answer-field";
import { answerText, gradeAnswer, inkMode, needsConfirm, type ExpectKind, type Recognition } from "@/lib/ink/recognition";
import { FALLBACK_CODES, InkError, readWorksheet, useInkStatus } from "@/lib/ink/client";
import { splitWorksheet } from "@/lib/ink/text";
import { canonicalSet, parseSetAnswer } from "@/lib/math/sets";
import { evaluate } from "@/lib/math/calc";
import { MathText, Tex, texToPlain } from "@/components/math/tex";
import { MathInput } from "@/components/math/math-input";
import { InkEditor, useInkDoc } from "@/components/ink/ink-editor";
import { InkCanvas } from "@/components/ink/ink-canvas";
import { worksheetHeight } from "@/lib/ink/model";

/** Typing is the default; "1" = this student chose to write by hand. */
const HAND_PREF = "usr-ink-handwriting";
const spring = { type: "spring", stiffness: 460, damping: 38 } as const;

type Line = { input: string; result: { correct: boolean; message: string } | null; read?: Recognition; confirm?: boolean; fixing?: boolean };

const toTex = (t: string) => t.replace(/∅/g, "\\emptyset ").replace(/[{}]/g, (m) => `\\${m}`).replace(/−/g, "-");

function valueOf(kind: ExpectKind, text: string): number | string[] | null {
  if (kind === "set") {
    const p = parseSetAnswer(text);
    return p.ok ? canonicalSet(p.elements) : [];
  }
  try {
    return evaluate(text);
  } catch {
    return null;
  }
}

/**
 * WRITTEN answers (sets / numbers): ONE answer area for the whole question, one line per labelled part
 * ("A ∪ B = ____") and ONE Check. Typing into the labelled lines is the default; "Write by hand" uses one
 * Answer Paper with the labels printed on it, read by the AI in ONE call, graded per line by our checker.
 */
export function WrittenAnswer({
  parts,
  paperKey,
  saved,
  oneShot,
  onPart,
  checkLabel = "Check",
  title,
}: {
  /** The question, shown at the top of the full-screen writing sheet on phones. */
  title?: React.ReactNode;
  parts: QPart[];
  paperKey: string;
  saved: Record<number, FieldResult | undefined>;
  oneShot: boolean;
  onPart: (j: number, r: FieldResult) => void;
  checkLabel?: string;
}) {
  const labels = parts.map((p, j) => (p.label ? texToPlain(p.label).replace(/\s*=\s*$/, "") : parts.length > 1 ? `(${j + 1})` : "Answer"));
  const kinds = parts.map((p) => p.spec.kind as ExpectKind);
  // Choice lines ("Equal ✓ / Not equal ✗") are tapped, never written: the paper only has the set / number lines.
  const isChoice = (j: number) => parts[j]!.spec.kind === "choice";
  const paperIdx = parts.map((_, j) => j).filter((j) => !isChoice(j));
  const paperLabels = paperIdx.map((j) => labels[j]!);
  const paperKinds = paperIdx.map((j) => kinds[j]!);
  const [lines, setLines] = useState<Line[]>(() =>
    parts.map((_, j) => {
      const s = saved[j];
      return { input: s?.input ?? "", result: s ? { correct: s.correct, message: s.correct ? "Correct!" : "" } : null };
    }),
  );
  const [hand, setHand] = useState(false);
  const [forcedNote, setForcedNote] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [party, setParty] = useState(0);
  const status = useInkStatus();
  const auto = inkMode(status);
  const api = useInkDoc(`paper:${paperKey}`);
  // The paper works without the AI too: typed text boxes are checked directly; only handwriting needs it.
  const useHand = hand && !forcedNote;
  const phone = usePhone();
  const layout = phone ? "stacked" : "side";
  const [sheet, setSheet] = useState(false);

  // Full-screen sheet on phones: no page scroll / pull-to-refresh behind it.
  useEffect(() => {
    if (!sheet) return;
    document.documentElement.classList.add("ink-sheet-open");
    return () => document.documentElement.classList.remove("ink-sheet-open");
  }, [sheet]);
  const graded = lines.filter((l) => l.result && l.result.message !== "").length;
  const correct = lines.filter((l) => l.result?.correct).length;
  const done = lines.every((l) => l.result);
  const locked = oneShot && done;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHand(window.localStorage.getItem(HAND_PREF) === "1");
    } catch {}
  }, []);
  const chooseHand = (v: boolean) => {
    setHand(v);
    setForcedNote(null);
    try {
      window.localStorage.setItem(HAND_PREF, v ? "1" : "0");
    } catch {}
  };

  const setLine = (j: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === j ? { ...l, ...patch } : l)));

  /** Grade one line with OUR checker and report it. */
  const gradeLine = (j: number, text: string, quiet = false) => {
    const g = gradeAnswer(text, kinds[j]!, parts[j]!.spec.kind === "set" || parts[j]!.spec.kind === "number" ? (parts[j]!.spec as { value: number | string[] }).value : []);
    setLine(j, { input: text, result: { correct: g.correct, message: g.message }, confirm: false, fixing: false });
    onPart(j, { correct: g.correct, input: text, chosen: null, value: valueOf(kinds[j]!, text) });
    if (!quiet && g.correct) setParty((n) => n + 1);
    return g.correct;
  };

  /** A choice line: the tapped option index is kept in `input`. */
  const gradeChoice = (j: number, quiet = true) => {
    const spec = parts[j]!.spec;
    const chosen = Number(lines[j]!.input);
    if (spec.kind !== "choice" || !lines[j]!.input) return false;
    const ok = chosen === spec.correct;
    setLine(j, { result: { correct: ok, message: ok ? "Correct!" : "Not quite: compare the two sides again." } });
    onPart(j, { correct: ok, input: spec.options[chosen] ?? "", chosen, value: null });
    if (!quiet && ok) setParty((n) => n + 1);
    return ok;
  };
  const choicesMissing = () => parts.some((_, j) => isChoice(j) && !lines[j]!.input && !(oneShot && lines[j]!.result));
  const gradeChoices = () => {
    let all = true;
    parts.forEach((_, j) => {
      if (isChoice(j) && !(oneShot && lines[j]!.result)) all = gradeChoice(j) && all;
    });
    return all;
  };

  /** One Check for the whole question (typed lines). */
  const checkTyped = () => {
    setError(null);
    const todo = lines.map((l, j) => ({ l, j })).filter(({ l, j }) => !isChoice(j) && !(oneShot && l.result));
    if (todo.some(({ l }) => !l.input.trim()) || choicesMissing()) {
      setError(parts.length > 1 ? "Fill in every line, then check." : "Type your answer first.");
      return;
    }
    let all = gradeChoices();
    for (const { l, j } of todo) all = gradeLine(j, l.input, true) && all;
    if (all) setParty((n) => n + 1);
  };

  /** One Check for the whole paper: ONE AI call reads every line. */
  const checkInk = async () => {
    setError(null);
    if (!api.doc.items.length) return setError("Write your answers on the lines first.");
    if (choicesMissing()) return setError("Choose your conclusion too, then check.");
    // Typed text boxes / placed symbols are read DIRECTLY (exact, free). Only handwritten lines go to the AI.
    const split = splitWorksheet(api.doc.items, paperLabels.length, layout);
    let all = gradeChoices();
    for (const [r, text] of split.typed) {
      const j = paperIdx[r]!;
      if (oneShot && lines[j]?.result) continue;
      setLine(j, { read: { latex: text, type: kinds[j]!, elements: null, value: null, confidence: 1 } });
      all = gradeLine(j, text, true) && all;
    }
    if (!split.inkRows.length) {
      if (!split.typed.size) return setError("Write your answers on the lines first.");
      setSheet(false);
      if (all) setParty((n) => n + 1);
      return;
    }
    if (auto.mode !== "ink") {
      setError(`${auto.note ?? "Handwriting checks are off."} Typed text boxes (T) are checked without the AI.`);
      return;
    }
    setPhase("reading");
    try {
      const rows = split.inkRows;
      const { result } = await readWorksheet(
        split.inkItems,
        rows.map((r) => paperLabels[r]!),
        rows.map((r) => paperKinds[r]!),
        layout,
      );
      setSheet(false);
      result.forEach((r, k) => {
        const j = paperIdx[rows[k]!]!;
        if (oneShot && lines[j]?.result) return;
        const t = answerText(r, kinds[j]!);
        if (needsConfirm(r) || !t) {
          all = false;
          setLine(j, { input: t, read: r, confirm: true, result: null });
        } else {
          setLine(j, { read: r });
          all = gradeLine(j, t, true) && all;
        }
      });
      if (all) setParty((n) => n + 1);
      status.refresh();
    } catch (e) {
      if (e instanceof InkError && FALLBACK_CODES.has(e.code)) {
        setForcedNote(
          e.code === "login_required"
            ? "Log in to have your handwriting checked. Type your answers for now."
            : e.code === "limit"
              ? "You've used today's handwriting checks. Type your answers; they reset tomorrow."
              : "Handwriting checks are off right now. Please type your answers.",
        );
      } else if (e instanceof InkError && e.code === "too_fast") setError("One moment… try again in a few seconds.");
      else setError("I couldn't read it right now. Try again, or type your answers.");
    } finally {
      setPhase("idle");
    }
  };

  // On the paper, only lines that were READ from the paper get a ✓ / ✗.
  const marks = paperIdx.map((j) => {
    const l = lines[j]!;
    return l.read && l.result && l.result.message !== "" ? l.result.correct : null;
  });

  /** A choice line: two (or more) big buttons. */
  const choiceRow = (p: QPart, j: number) => {
    if (p.spec.kind !== "choice") return null;
    const l = lines[j]!;
    const lineLocked = oneShot && !!l.result;
    return (
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex shrink-0 items-center gap-1.5 text-[16px] font-medium text-ink sm:w-56 sm:justify-end sm:text-right">
          {l.result && (l.result.correct ? <Check className="size-4 text-good" aria-label="correct" /> : <X className="size-4 text-bad" aria-label="wrong" />)}
          {p.label ? <MathText text={p.label} /> : labels[j]}
        </span>
        <div className="flex flex-1 flex-wrap gap-2" role="radiogroup" aria-label={labels[j]}>
          {p.spec.options.map((o, k) => {
            const on = l.input === String(k);
            const tone = l.result && on ? (l.result.correct ? "border-good bg-good-soft" : "border-bad bg-bad-soft") : on ? "border-accent bg-[var(--accent-tint)]" : "border-line bg-surface";
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={lineLocked}
                onClick={() => setLine(j, { input: String(k), ...(l.result && !oneShot ? { result: null } : {}) })}
                className={`min-h-11 flex-1 rounded-2xl border-2 px-4 py-2 text-[15px] font-medium text-ink transition-colors disabled:cursor-default ${tone}`}
              >
                <MathText text={o} />
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  /** "Left side" / "Right side" headings between the lines. */
  const groupHead = (j: number) => {
    const g = parts[j]!.group;
    if (!g || (j > 0 && parts[j - 1]!.group === g)) return null;
    return <p className="pt-2 text-xs font-semibold tracking-wide text-accent-ink uppercase first:pt-0">{g}</p>;
  };
  const note =
    forcedNote ??
    (hand && auto.mode === "type" && !status.loading
      ? `${auto.note} On the paper, text typed with the Text tool (T) is checked without the AI.`
      : null);

  return (
    <div className="relative">
      {note && <p className="mb-2 rounded-xl bg-note-soft px-3 py-2 text-[13px] text-note">{note}</p>}

      {useHand && phone ? (
        /* Phone: a preview of the paper; tap it to write full screen (like a solver app). */
        <button
          type="button"
          onClick={() => !locked && setSheet(true)}
          aria-label="Open the answer paper to write"
          className="relative block w-full overflow-hidden rounded-2xl text-left ring-1 ring-line-strong"
          style={{ height: Math.min(260, worksheetHeight(paperLabels.length, "stacked")) }}
        >
          <InkCanvas doc={api.doc} readOnly fit labels={paperLabels} marks={marks} layout="stacked" className="absolute inset-0" ariaLabel="Your answer paper" />
          {!locked && (
            <span className="absolute right-2 bottom-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white shadow">
              {api.doc.items.length ? <Maximize2 className="size-3.5" aria-hidden /> : <PencilLine className="size-3.5" aria-hidden />}
              {api.doc.items.length ? "Edit" : "Tap to write"}
            </span>
          )}
        </button>
      ) : useHand ? (
        <InkEditor
          api={api}
          labels={paperLabels}
          marks={marks}
          ariaLabel={`Answer paper ${paperKey}`}
          className="rounded-2xl ring-1 ring-line"
          paperClassName=""
          autoFocusKeys
          heightPx={Math.max(220, worksheetHeight(paperLabels.length))}
          toolbar="top"
        />
      ) : (
        <ol className="space-y-2.5">
          {parts.map((p, j) => {
            const l = lines[j]!;
            const lineLocked = oneShot && !!l.result && !l.fixing;
            if (isChoice(j))
              return (
                <li key={j}>
                  {groupHead(j)}
                  {choiceRow(p, j)}
                </li>
              );
            return (
              <li key={j} className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3">
                {groupHead(j) && <div className="w-full">{groupHead(j)}</div>}
                <span className="flex shrink-0 items-center gap-1.5 pt-0 text-[16px] font-medium text-ink sm:w-56 sm:justify-end sm:text-right sm:pt-3">
                  {l.result && l.result.message !== "" && (l.result.correct ? <Check className="size-4 text-good" aria-label="correct" /> : <X className="size-4 text-bad" aria-label="wrong" />)}
                  {p.label ? <MathText text={p.label} /> : labels[j]} =
                </span>
                <div className="min-w-0 flex-1">
                  <MathInput
                    value={l.input}
                    onChange={(v) => setLine(j, { input: v, ...(l.result && !l.result.correct && !oneShot ? { result: null } : {}) })}
                    onEnter={checkTyped}
                    disabled={lineLocked}
                    ariaLabel={labels[j]!}
                    placeholder={p.spec.kind === "set" ? "{ … }  or  ∅" : "a number"}
                    state={l.result?.correct ? "good" : l.result && l.result.message !== "" ? "bad" : "idle"}
                  />
                  {l.result && !l.result.correct && l.result.message && <p className="mt-1 text-[13px] text-bad">{l.result.message}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {useHand && paperIdx.length < parts.length && (
        <div className="mt-3 space-y-2.5">
          {parts.map((p, j) =>
            isChoice(j) ? (
              <div key={j}>
                {groupHead(j)}
                {choiceRow(p, j)}
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* Phone writing sheet: question on top, full-width labelled lines, tools, Check at the bottom. */}
      {useHand && phone && sheet && typeof document !== "undefined" &&
        createPortal(
          <motion.div
            role="dialog"
            aria-label="Answer paper"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={spring}
            className="fixed inset-0 z-[90] flex flex-col bg-surface pt-[env(safe-area-inset-top)]"
          >
            <div className="flex items-start gap-2 border-b border-line px-4 py-2.5">
              <div className="max-h-24 min-w-0 flex-1 overflow-y-auto text-[15px] leading-snug text-ink">{title}</div>
              <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/[0.06]">
                <ChevronDown className="size-5" aria-hidden />
              </button>
            </div>
            <InkEditor api={api} labels={paperLabels} marks={marks} layout="stacked" ariaLabel={`Answer paper ${paperKey}`} className="min-h-0 flex-1" />
            <div className="flex items-center gap-2 border-t border-line bg-surface px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => (setSheet(false), chooseHand(false))} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted">
                <Keyboard className="size-4" aria-hidden /> Type instead
              </button>
              <button
                type="button"
                onClick={checkInk}
                disabled={phase === "reading"}
                className="ml-auto inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 font-medium text-white disabled:opacity-70"
              >
                {phase === "reading" ? <span className="spinner !size-4 !border-white/30 !border-t-white" aria-hidden /> : <ScanText className="size-4" aria-hidden />}
                {phase === "reading" ? "Reading…" : checkLabel}
              </button>
            </div>
            {error && <p className="bg-bad-soft px-4 py-2 text-sm text-bad">{error}</p>}
          </motion.div>,
          document.body,
        )}

      {/* AI reading, per line: "I read: …", ✓/✗, Fix it */}
      {useHand && lines.some((l) => l.read || l.confirm) && (
        <ul className="mt-3 space-y-2">
          {lines.map((l, j) =>
            l.read || l.confirm ? (
              <li key={j} className="rounded-2xl bg-paper px-3 py-2.5 ring-1 ring-line">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
                  {l.result && l.result.message !== "" && (l.result.correct ? <Check className="size-4 text-good" aria-label="correct" /> : <X className="size-4 text-bad" aria-label="wrong" />)}
                  <span className="font-medium text-ink">{labels[j]} =</span>
                  <span className="text-sm text-muted">I read:</span>
                  {l.input ? <Tex tex={toTex(l.input)} /> : <em className="text-sm text-muted">nothing readable</em>}
                  {!l.fixing && (!oneShot || !l.result || !l.result.correct) && (
                    <button type="button" onClick={() => setLine(j, { fixing: true })} className="ml-auto text-sm font-medium text-accent-ink underline underline-offset-2">
                      {l.result && !l.result.correct ? "Did I read it wrong?" : "Fix it"}
                    </button>
                  )}
                </p>
                {l.confirm && !l.fixing && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink">Did I read that right?</span>
                    {l.input && (
                      <button type="button" onClick={() => gradeLine(j, l.input)} className="h-9 rounded-full bg-accent px-4 text-sm font-medium text-white">
                        Yes, check it
                      </button>
                    )}
                    <button type="button" onClick={() => setLine(j, { fixing: true })} className="h-9 rounded-full bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line">
                      Fix it
                    </button>
                  </div>
                )}
                {l.fixing && <FixLine initial={l.input} label={labels[j]!} onCheck={(t) => gradeLine(j, t)} />}
                {l.result && !l.result.correct && l.result.message && <p className="mt-1 text-[13px] text-bad">{l.result.message}</p>}
              </li>
            ) : null,
          )}
        </ul>
      )}

      {/* one Check for the whole question */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!locked && (
          <button
            type="button"
            onClick={useHand ? checkInk : checkTyped}
            disabled={phase === "reading"}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 font-medium text-white transition-transform active:scale-95 disabled:opacity-70"
          >
            {phase === "reading" ? <span className="spinner !size-4 !border-white/30 !border-t-white" aria-hidden /> : useHand ? <ScanText className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {phase === "reading" ? "Reading…" : checkLabel}
          </button>
        )}
        <AnimatePresence>
          {graded > 0 && parts.length > 1 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${correct === parts.length ? "bg-good-soft text-good" : "bg-paper text-ink ring-1 ring-line"}`}
            >
              {correct} / {parts.length} parts correct
            </motion.span>
          )}
          {graded > 0 && parts.length === 1 && lines[0]?.result?.correct && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1 text-sm font-medium text-good">
              <Check className="size-4" aria-hidden /> Correct!
            </motion.span>
          )}
        </AnimatePresence>
        {!locked && !forcedNote && (
          <button type="button" onClick={() => chooseHand(!hand)} className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-ink/[0.05]">
            {hand ? <Keyboard className="size-4" aria-hidden /> : <PencilLine className="size-4" aria-hidden />}
            {hand ? "Type instead" : "Write by hand"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <Celebrate trigger={party} />
    </div>
  );
}

function FixLine({ initial, label, onCheck }: { initial: string; label: string; onCheck: (t: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <MathInput value={v} onChange={setV} onEnter={() => onCheck(v)} ariaLabel={`Correct ${label}`} />
      </div>
      <button type="button" onClick={() => onCheck(v)} className="h-12 shrink-0 rounded-2xl bg-accent px-5 font-medium text-white">
        Check line
      </button>
    </div>
  );
}

function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
