/** A piece of text in both languages. Inline `**double asterisks**` mark a highlighted key term. */
export type Bi = { en: string; am: string };

export type Lang = "en" | "am" | "both";

/* ---------- Note blocks (stored in lesson_sections.blocks) ---------- */

export type HeadingBlock = { type: "heading"; text: Bi };
export type ParagraphBlock = { type: "paragraph"; text: Bi };
export type KeyPointBlock = {
  type: "keypoint";
  /** definition = the "learn this" box, important = must-know, note = textbook/extra note */
  variant?: "definition" | "important" | "note";
  icon?: string;
  title: Bi;
  text: Bi;
};
export type ListBlock = { type: "list"; ordered?: boolean; items: Bi[] };
export type TableBlock = { type: "table"; caption?: Bi; headers: Bi[]; rows: Bi[][] };
export type ExampleBlock = { type: "example"; title: Bi; text: Bi };
export type TipBlock = { type: "tip"; title: Bi; text: Bi };
export type TermsBlock = { type: "terms"; title: Bi; items: Bi[] };
export type PointsBlock = { type: "points"; items: { icon: string; title: Bi; text: Bi }[] };
export type ImageBlock = {
  type: "image";
  src: string;
  width: number;
  height: number;
  alt: Bi;
  caption?: Bi;
  credit: string;
  creditUrl?: string;
};

/* ---------- Math toolkit (stored as JSON data, rendered with KaTeX + SVG) ---------- */

/** Venn diagram data. Regions: "A" (only A), "AB", "ABC", … and "none" (inside U, outside every circle). */
export type VennData = { sets: 2 | 3; labels?: string[]; elements?: Record<string, string[]> };
/** Interactive Venn diagram. `shade` and step shades are set expressions like "A∩B∖C". */
export type VennBlock = { type: "venn"; venn: VennData; shade?: string; steps?: { shade: string; text: Bi }[]; caption?: Bi; showElements?: boolean };
export type WorkedStep = { text: Bi; why?: Bi; shade?: string };
/** Paper-mode worked example: steps appear one at a time, each with a "Why?". */
export type WorkedBlock = { type: "worked"; title: Bi; problem: Bi; steps: WorkedStep[]; answer: Bi; venn?: VennData };

/** How an answer is checked (homework and quiz). */
export type AnswerSpec =
  | { kind: "choice"; options: Bi[]; correct: number }
  | { kind: "number"; value: number }
  | { kind: "set"; value: string[] }
  | { kind: "venn"; venn: VennData; regions: string[] };

export type HomeworkItem = {
  id: string;
  /** choice | written | venn | open (no checkable answer). Inferred from the answers when missing. */
  type?: "choice" | "written" | "venn" | "open";
  question: Bi;
  tip: Bi;
  hints: Bi[];
  /** The labelled parts. `group` = a heading above the line (e.g. "Left side"). */
  answers: { label: Bi; spec: AnswerSpec; group?: Bi }[];
  /** A drawing shown at the top of the card (e.g. the numbered Venn from class). */
  figure?: { venn: VennData; caption?: Bi };
  /** Shown after Check: the shadings side by side, e.g. the left side and the right side. */
  compare?: { label: Bi; shade: string }[];
  /** Warm-up before the homework: shown first, never counted. */
  warmup?: boolean;
  solution: { steps: WorkedStep[]; answer: Bi; venn?: VennData };
};

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | KeyPointBlock
  | ListBlock
  | TableBlock
  | ExampleBlock
  | TipBlock
  | TermsBlock
  | PointsBlock
  | ImageBlock
  | VennBlock
  | WorkedBlock;

export type MainTopic = { title: Bi; points: Bi[] };
export type GlossaryEntry = { term: Bi; definition: Bi };

/* ---------- Rows as used by the UI ---------- */

/** draft = admins only; coming_soon = listed but not openable; published = live. */
export type ContentStatus = "published" | "draft" | "coming_soon";

export type Subject = {
  id: string;
  slug: string;
  name_en: string;
  name_am: string;
  description_en: string;
  description_am: string;
  sort_order: number;
  status?: ContentStatus;
  /** Admin colour override (#rrggbb), icon name and illustration URL. */
  color?: string | null;
  icon?: string | null;
  illustration?: string | null;
};

export type Grade = {
  id: string;
  subject_id: string;
  number: number;
  slug: string;
  name_en: string;
  name_am: string;
  curriculum_en: string;
  curriculum_am: string;
  status?: ContentStatus;
};

export type Unit = {
  id: string;
  grade_id: string;
  number: number;
  slug: string;
  label_en: string;
  label_am: string;
  title_en: string;
  title_am: string;
  description_en: string;
  description_am: string;
  status?: ContentStatus;
};

export type LessonSummary = {
  id: string;
  unit_id: string;
  code: string;
  slug: string;
  sort_order: number;
  section_code: string;
  section_title_en: string;
  section_title_am: string;
  title_en: string;
  title_am: string;
  summary_en: string;
  summary_am: string;
  minutes: number;
  status?: ContentStatus;
  /** Number of note parts (from lesson_sections(count)). */
  partCount?: number;
};

export type LessonSection = {
  id: string;
  sort_order: number;
  title_en: string;
  title_am: string;
  icon: string;
  blocks: Block[];
};

export type Lesson = LessonSummary & {
  main_topics: MainTopic[];
  glossary: GlossaryEntry[];
  homework: HomeworkItem[];
  /** Optional "Extra practice" (same shape as homework, never counted as homework). */
  practice: HomeworkItem[];
  lesson_sections: LessonSection[];
};

export type QuizQuestion = {
  id: string;
  sort_order: number;
  question_en: string;
  question_am: string;
  options_en: string[];
  options_am: string[];
  correct_index: number;
  explanation_en: string;
  explanation_am: string;
  /** choice (default) | number | set | venn */
  kind?: "choice" | "number" | "set" | "venn";
  /** number: { value } · set: { value: [...] } · venn: { venn, regions } */
  answer?: { value?: number | string[]; venn?: VennData; regions?: string[] } | null;
  /** Step-by-step explanation shown after answering. */
  steps?: { text: Bi }[];
};
