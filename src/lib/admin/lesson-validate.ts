/**
 * Shape + size checks for lesson content edited in the admin (used in the editor AND again on the server
 * before saving). Mirrors the rules of scripts/lesson-to-sql.mjs.
 */
import ICONS from "@/lib/icon-names.json";
import type { AnswerSpec, Bi, Block, GlossaryEntry, HomeworkItem, MainTopic, VennData, WorkedStep } from "@/lib/types";
import { evalVenn, REGIONS } from "@/lib/math/venn";

export type EditorSection = { id: string | null; key: string; title_en: string; title_am: string; icon: string; blocks: Block[] };
export type EditorQuestion = {
  id: string | null;
  key: string;
  question_en: string;
  question_am: string;
  options_en: string[];
  options_am: string[];
  correct_index: number;
  /** choice (default) | number | set | venn */
  kind?: "choice" | "number" | "set" | "venn";
  /** number: { value } · set: { value: [...] } · venn: { venn, regions } */
  answer?: { value?: number | string[]; venn?: VennData; regions?: string[] } | null;
  steps?: { text: Bi }[];
  explanation_en: string;
  explanation_am: string;
};
export type EditorData = {
  lesson: {
    id: string;
    code: string;
    slug: string;
    status: string;
    minutes: number;
    title_en: string;
    title_am: string;
    summary_en: string;
    summary_am: string;
    section_code: string;
    section_title_en: string;
    section_title_am: string;
    updated_at?: string;
  };
  glossary: GlossaryEntry[];
  main_topics: MainTopic[];
  homework?: HomeworkItem[];
  practice?: HomeworkItem[];
  sections: EditorSection[];
  quiz: null | {
    id: string | null;
    title_en: string;
    title_am: string;
    description_en: string;
    description_am: string;
    questions: EditorQuestion[];
  };
};

export const BLOCK_TYPES = ["paragraph", "keypoint", "points", "list", "table", "example", "tip", "terms", "heading", "image", "venn", "worked"] as const;
export const ICON_NAMES = ICONS as string[];

const isStr = (v: unknown, max = 4000) => typeof v === "string" && v.length <= max;
const filled = (v: unknown, max = 4000) => isStr(v, max) && (v as string).trim().length > 0;
const isBi = (v: unknown, max = 4000): v is Bi => !!v && typeof v === "object" && filled((v as Bi).en, max) && isStr((v as Bi).am, max);

function vennOk(v: VennData | undefined): boolean {
  return !!v && (v.sets === 2 || v.sets === 3) && (!v.labels || (v.labels.length === v.sets && v.labels.every((l) => filled(l, 3))));
}
function shadeOk(expr: string | undefined, v: VennData): boolean {
  if (!expr) return true;
  try {
    evalVenn(expr, v.sets, v.labels ?? ["A", "B", "C"].slice(0, v.sets));
    return true;
  } catch {
    return false;
  }
}
function stepsOk(steps: WorkedStep[] | undefined, venn?: VennData): boolean {
  return (
    Array.isArray(steps) &&
    steps.length >= 1 &&
    steps.length <= 14 &&
    steps.every((s) => isBi(s.text, 1000) && (!s.why || isStr(s.why.en, 1000)) && (!s.shade || (!!venn && shadeOk(s.shade, venn))))
  );
}
function specProblem(s: AnswerSpec): string | null {
  if (s?.kind === "choice")
    return Array.isArray(s.options) && s.options.length >= 2 && s.options.length <= 6 && s.options.every((o) => isBi(o, 300)) && Number.isInteger(s.correct) && s.correct >= 0 && s.correct < s.options.length
      ? null
      : "multiple choice needs 2–6 filled options and a correct one";
  if (s?.kind === "number") return Number.isFinite(s.value) ? null : "the correct number is missing";
  if (s?.kind === "set") return Array.isArray(s.value) && s.value.length <= 60 && s.value.every((x) => typeof x === "string" && x.length <= 40) ? null : "the correct set is invalid";
  if (s?.kind === "venn")
    return vennOk(s.venn) && Array.isArray(s.regions) && s.regions.length > 0 && s.regions.every((r) => REGIONS[s.venn.sets].includes(r)) ? null : "tap the regions that should be shaded";
  return "choose an answer type";
}

function checkBlock(b: Block, where: string, out: string[]) {
  const need = (ok: boolean, msg: string) => !ok && out.push(`${where}: ${msg}`);
  switch (b?.type) {
    case "heading":
    case "paragraph":
      need(isBi(b.text), "text is empty");
      break;
    case "keypoint":
      need(isBi(b.title, 300) && isBi(b.text), "title and text are needed");
      need(!b.variant || ["definition", "important", "note"].includes(b.variant), "unknown variant");
      need(!b.icon || ICON_NAMES.includes(b.icon), "unknown icon");
      break;
    case "list":
      need(Array.isArray(b.items) && b.items.length >= 1 && b.items.length <= 8 && b.items.every((x) => isBi(x)), "needs 1–8 filled items");
      break;
    case "table":
      need(Array.isArray(b.headers) && b.headers.length >= 1 && b.headers.length <= 6 && b.headers.every((x) => isBi(x, 300)), "needs 1–6 column headers");
      need(
        Array.isArray(b.rows) && b.rows.length >= 1 && b.rows.length <= 20 && b.rows.every((r) => Array.isArray(r) && r.length === b.headers.length && r.every((c) => isBi(c))),
        "every row needs one filled cell per column",
      );
      break;
    case "example":
    case "tip":
      need(isBi(b.title, 300) && isBi(b.text), "title and text are needed");
      break;
    case "terms":
      need(isBi(b.title, 300) && Array.isArray(b.items) && b.items.length >= 1 && b.items.every((x) => isBi(x, 300)), "title and at least one term are needed");
      break;
    case "points":
      need(
        Array.isArray(b.items) && b.items.length >= 2 && b.items.length <= 6 && b.items.every((x) => ICON_NAMES.includes(x.icon) && isBi(x.title, 300) && isBi(x.text)),
        "needs 2–6 points, each with an icon, title and text",
      );
      break;
    case "image":
      need(typeof b.src === "string" && (/^https:\/\//.test(b.src) || /^\/[\w\-./]+$/.test(b.src)), "image source must be an https URL or a /public path");
      need(Number.isInteger(b.width) && Number.isInteger(b.height) && b.width > 0 && b.height > 0, "image size is missing");
      need(isBi(b.alt, 500), "alt text is needed (describe the image)");
      need(filled(b.credit, 300), "credit line is needed");
      break;
    case "venn":
      need(vennOk(b.venn), "choose 2 or 3 sets (labels up to 3 letters)");
      if (vennOk(b.venn)) {
        need(shadeOk(b.shade, b.venn), "the shade expression is not valid");
        need(!b.steps || (b.steps.length <= 8 && b.steps.every((s) => filled(s.shade, 200) && shadeOk(s.shade, b.venn) && isBi(s.text, 500))), "every step needs a valid shade and a caption");
      }
      break;
    case "worked":
      need(isBi(b.title, 300) && isBi(b.problem, 2000) && isBi(b.answer, 1000), "title, problem and final answer are needed");
      need(!b.venn || vennOk(b.venn), "the Venn diagram needs 2 or 3 sets");
      need(stepsOk(b.steps, b.venn), "needs 1–14 steps with text (and valid shades)");
      break;
    default:
      out.push(`${where}: unknown block type`);
  }
}

/** Returns a list of problems (empty = OK to publish). */
export function validateLesson(d: EditorData): string[] {
  const out: string[] = [];
  const l = d?.lesson;
  if (!l) return ["Missing lesson"];
  if (!filled(l.title_en, 200) || !filled(l.title_am, 200)) out.push("Lesson title is needed in both languages");
  if (!isStr(l.summary_en, 1000) || !isStr(l.summary_am, 1000)) out.push("Summary is too long");
  if (!Number.isInteger(Number(l.minutes)) || Number(l.minutes) < 1 || Number(l.minutes) > 240) out.push("Minutes must be 1–240");

  if (!Array.isArray(d.sections) || d.sections.length < 1 || d.sections.length > 30) out.push("A lesson needs 1–30 parts");
  d.sections?.forEach((s, i) => {
    const w = `Part ${i + 1}`;
    if (!filled(s.title_en, 200) || !filled(s.title_am, 200)) out.push(`${w}: title is needed in both languages`);
    if (!ICON_NAMES.includes(s.icon)) out.push(`${w}: choose an icon`);
    if (!Array.isArray(s.blocks) || s.blocks.length < 1 || s.blocks.length > 8) out.push(`${w}: needs 1–8 blocks`);
    s.blocks?.forEach((b, j) => checkBlock(b, `${w}, block ${j + 1}`, out));
  });

  if (!Array.isArray(d.glossary) || d.glossary.length > 60) out.push("Key terms: max 60");
  d.glossary?.forEach((g, i) => {
    if (!isBi(g.term, 200) || !isBi(g.definition, 1000)) out.push(`Key term ${i + 1}: term and definition are needed`);
  });
  if (!Array.isArray(d.main_topics) || d.main_topics.length > 12) out.push("Main topics: max 12");
  d.main_topics?.forEach((t, i) => {
    if (!isBi(t.title, 200) || !Array.isArray(t.points) || !t.points.length || !t.points.every((p) => isBi(p, 1000))) out.push(`Main topic ${i + 1}: title and points are needed`);
  });

  for (const [list, name] of [
    [d.homework, "Homework"],
    [d.practice, "Extra practice"],
  ] as const) {
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.length > 30) out.push(`${name}: max 30 exercises`);
    const ids = new Set<string>();
    list?.forEach((h, i) => {
      const w = `${name} ${i + 1}`;
      if (!/^[a-z0-9-]{1,20}$/.test(h.id ?? "") || ids.has(h.id)) out.push(`${w}: needs a unique id`);
      if (h.type !== undefined && !["choice", "written", "venn", "open"].includes(h.type)) out.push(`${w}: unknown question type`);
      ids.add(h.id);
      if (!isBi(h.question, 2000) || !isBi(h.tip, 1000)) out.push(`${w}: question and tip are needed`);
      if (!Array.isArray(h.hints) || h.hints.length > 4 || !h.hints.every((x) => isBi(x, 1000))) out.push(`${w}: hints need text (max 4)`);
      if (!Array.isArray(h.answers) || h.answers.length > 8) out.push(`${w}: max 8 answer boxes`);
      h.answers?.forEach((a, j) => {
        if (!isBi(a.label, 300)) out.push(`${w}, answer box ${j + 1}: label is needed`);
        const p = specProblem(a.spec);
        if (p) out.push(`${w}, answer box ${j + 1}: ${p}`);
      });
      if (!h.solution || !isBi(h.solution.answer, 1000) || (h.solution.venn && !vennOk(h.solution.venn)) || !stepsOk(h.solution.steps, h.solution.venn))
        out.push(`${w}: the solution needs steps and a final answer`);
    });
  }

  if (d.quiz) {
    const qs = d.quiz.questions ?? [];
    if (qs.length > 40) out.push("Quiz: max 40 questions");
    qs.forEach((q, i) => {
      const w = `Question ${i + 1}`;
      if (!filled(q.question_en, 1000) || !filled(q.question_am, 1000)) out.push(`${w}: question text is needed in both languages`);
      if (q.steps && (!Array.isArray(q.steps) || q.steps.length > 10 || !q.steps.every((s) => isBi(s.text, 1000)))) out.push(`${w}: every step needs text (max 10)`);
      if (!isStr(q.explanation_en, 1500) || !isStr(q.explanation_am, 1500)) out.push(`${w}: explanation is too long`);
      const kind = q.kind ?? "choice";
      if (kind !== "choice") {
        const a = q.answer ?? {};
        const p =
          kind === "number"
            ? specProblem({ kind, value: a.value as number })
            : kind === "set"
              ? specProblem({ kind, value: a.value as string[] })
              : specProblem({ kind: "venn", venn: a.venn as VennData, regions: a.regions ?? [] });
        if (p) out.push(`${w}: ${p}`);
        return;
      }
      const n = q.options_en?.length ?? 0;
      if (n < 2 || n > 6 || q.options_am?.length !== n) out.push(`${w}: needs 2–6 options in both languages`);
      if (!q.options_en?.every((o) => filled(o, 300)) || !q.options_am?.every((o) => filled(o, 300))) out.push(`${w}: every option needs text`);
      if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= n) out.push(`${w}: choose the correct answer`);
    });
  }
  return out;
}

/** Remove editor-only fields before saving. Status is changed separately (it applies at once). */
export function toSavePayload(d: EditorData) {
  const { status: _status, updated_at: _u, ...lesson } = d.lesson;
  void _status;
  void _u;
  return {
    lesson,
    glossary: d.glossary,
    main_topics: d.main_topics,
    ...(d.homework ? { homework: d.homework } : {}),
    ...(d.practice ? { practice: d.practice } : {}),
    sections: d.sections.map(({ key: _k, ...s }) => (void _k, s)),
    quiz: d.quiz ? { ...d.quiz, questions: d.quiz.questions.map(({ key: _k, ...q }) => {
            void _k;
            const kind = q.kind ?? "choice";
            // Non-choice questions keep no options; choice questions keep no typed answer.
            return kind === "choice"
              ? { ...q, kind, answer: null }
              : { ...q, kind, options_en: [], options_am: [], correct_index: 0 };
          }) } : null,
  };
}
