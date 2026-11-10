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
  | ImageBlock;

export type MainTopic = { title: Bi; points: Bi[] };
export type GlossaryEntry = { term: Bi; definition: Bi };

/* ---------- Rows as used by the UI ---------- */

export type Subject = {
  id: string;
  slug: string;
  name_en: string;
  name_am: string;
  description_en: string;
  description_am: string;
  sort_order: number;
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
};
