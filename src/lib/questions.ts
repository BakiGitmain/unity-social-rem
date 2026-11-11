/**
 * ONE question model for Homework, Extra practice and the Quiz: the whole question + its labelled parts.
 * type: choice (tap an option) · written (set / number lines on one Answer Paper) · venn (shade diagrams) ·
 * open (no checkable answer: proofs / descriptions, solution only).
 */
import type { AnswerSpec, Bi, HomeworkItem, Lang, QuizQuestion, VennData, WorkedStep } from "@/lib/types";
import type { FieldSpec } from "@/components/math/answer-field";

export type QuestionType = "choice" | "written" | "venn" | "open";
export type QPart = { label: string; spec: FieldSpec; /** heading shown above this line, e.g. "Left side" */ group?: string };
export type UQuestion = {
  id: string;
  type: QuestionType;
  text: Bi;
  parts: QPart[];
  tip?: Bi;
  hints?: Bi[];
  solution?: { steps: WorkedStep[]; answer: Bi; venn?: VennData };
  /** Numbered drawing shown at the top (tap a region to see its number). */
  figure?: { venn: VennData; caption?: Bi };
  /** After Check: these shadings side by side (e.g. left side vs right side). */
  compare?: { label: Bi; shade: string }[];
  /** Quiz: shown after answering. */
  explanation?: Bi;
  steps?: { text: Bi }[];
};

export function inferType(kinds: FieldSpec["kind"][]): QuestionType {
  if (!kinds.length) return "open";
  if (kinds.every((k) => k === "choice")) return "choice";
  if (kinds.some((k) => k === "venn")) return "venn";
  return "written";
}

function fieldSpec(spec: AnswerSpec, lang: Lang): FieldSpec {
  if (spec.kind === "choice") return { kind: "choice", correct: spec.correct, options: spec.options.map((o) => (lang === "am" ? o.am : o.en)) };
  return spec;
}

export function fromHomework(item: HomeworkItem, lang: Lang): UQuestion {
  const parts = item.answers.map((a) => ({
    label: lang === "am" ? a.label.am : a.label.en,
    spec: fieldSpec(a.spec, lang),
    group: a.group ? (lang === "am" ? a.group.am : a.group.en) : undefined,
  }));
  return {
    id: item.id,
    type: item.type ?? inferType(parts.map((p) => p.spec.kind)),
    text: item.question,
    parts,
    tip: item.tip,
    hints: item.hints,
    solution: item.solution,
    figure: item.figure,
    compare: item.compare,
  };
}

export function fromQuiz(q: QuizQuestion, lang: "en" | "am"): UQuestion {
  const kind = q.kind ?? "choice";
  const spec: FieldSpec =
    kind === "number"
      ? { kind, value: Number(q.answer?.value ?? 0) }
      : kind === "set"
        ? { kind, value: (q.answer?.value as string[]) ?? [] }
        : kind === "venn"
          ? { kind, venn: q.answer?.venn ?? { sets: 2 }, regions: q.answer?.regions ?? [] }
          : { kind: "choice", options: lang === "am" ? q.options_am : q.options_en, correct: q.correct_index };
  return {
    id: q.id,
    type: inferType([spec.kind]),
    text: { en: q.question_en, am: q.question_am },
    parts: [{ label: "", spec }],
    explanation: { en: q.explanation_en, am: q.explanation_am },
    steps: q.steps,
  };
}
