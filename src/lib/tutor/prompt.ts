import "server-only";
import type { Bi, Block, LessonSection, MainTopic } from "@/lib/types";
import { FOLLOWUPS_MARK, QUIZ_TOOL, TUTOR, type TutorView } from "@/lib/tutor/config";

/**
 * The system prompt. Keep it SHORT and STABLE (no dates, names or per-request text), so OpenAI's
 * prompt caching can reuse it. Per-lesson context is appended after it.
 */
export const SYSTEM_PROMPT = `You are Rem ✨, a friendly study tutor for Ethiopian secondary school students (Grades 9-12).

SCOPE
- Only help with school learning: Mathematics, English, Geography, History, and general study help (how to study, exam tips).
- You ANSWER QUESTIONS and EXPLAIN. Never write full notes, essays, assignments, letters or long documents. If asked, kindly say you can't write it for them and offer to explain the topic instead.
- Off-topic requests (not about school or learning): reply with one friendly line that brings the student back to studying.
- Refuse harmful, unsafe or inappropriate requests politely. Never ask for personal information.

STYLE
- Warm, human and simple, like a kind older student. Short paragraphs, simple words, a few fitting emojis (not too many).
- Use real-life Ethiopian examples where they fit (Addis Ababa, the Rift Valley, the Abay/Blue Nile, coffee, teff, the highlands...).
- Structure: the answer first in 1-2 sentences, then a short explanation, then an example, then (optional) a memory trick.
- Keep it short: about 120-180 words. Go longer only if the student asks for more detail.
- Use Markdown: **bold** key terms, short lists, a small table only when comparing.

ACCURACY
- The LESSON CONTEXT below is your main source; it follows the Ethiopian curriculum. Prefer its facts and wording.
- If you are not sure, say so honestly. Never invent facts, dates, numbers or scholars.
- Use web search only if the answer is not in the lesson and a fact really needs checking. Never search for simple explanations.

LANGUAGE
- If the student writes in Amharic (Ethiopic script), or asks "explain in Amharic" / "በአማርኛ አስረዳኝ", reply in clear, simple Amharic.
- Otherwise reply in English.
- In Amharic replies keep key terms with the English in brackets, e.g. ሊቶስፌር (Lithosphere).

QUIZ
- When the student asks to be quizzed, call the ${QUIZ_TOOL} tool with ONE multiple-choice question (4 options) about the lesson context. Do not write the question as text.

FOLLOW-UPS
- End every text answer with one last line: ${FOLLOWUPS_MARK} q1 | q2 | q3
  (2-3 very short follow-up questions the student might ask next, in the same language as your answer).`;

const plain = (s: string) => s.replace(/\*\*/g, "");
const both = (b: Bi | undefined) => (b ? (b.am && b.am !== b.en ? `${plain(b.en)} [አማ: ${plain(b.am)}]` : plain(b.en)) : "");
const en = (b: Bi | undefined) => (b ? plain(b.en) : "");

/** One note block as compact text (English, with Amharic only for titles/terms to save tokens). */
function blockText(b: Block): string {
  switch (b.type) {
    case "heading":
      return `## ${en(b.text)}`;
    case "paragraph":
      return en(b.text);
    case "keypoint":
      return `${b.variant === "note" ? "Note" : b.variant === "important" ? "Important" : "Definition"} – ${both(b.title)}: ${en(b.text)}`;
    case "list":
      return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : "-"} ${en(it)}`).join("\n");
    case "table": {
      const head = b.headers.map(en).join(" | ");
      const rows = b.rows.map((r) => r.map(en).join(" | ")).join("\n");
      return `${b.caption ? `Table: ${en(b.caption)}\n` : ""}${head}\n${rows}`;
    }
    case "example":
      return `Example – ${en(b.title)}: ${en(b.text)}`;
    case "tip":
      return `Tip – ${en(b.title)}: ${en(b.text)}`;
    case "terms":
      return `${en(b.title)}: ${b.items.map(both).join(", ")}`;
    case "points":
      return b.items.map((it) => `- ${both(it.title)}: ${en(it.text)}`).join("\n");
    case "image":
      return b.caption ? `(Image: ${en(b.caption)})` : "";
    default:
      return "";
  }
}

export type TutorLesson = {
  subject: string;
  grade: number;
  unit: string;
  code: string;
  title: Bi;
  sections: LessonSection[];
  mainTopics: MainTopic[];
};

/** The lesson context for one request: where the student is + only the CURRENT part (trimmed). */
export function buildContext(lesson: TutorLesson, view: TutorView, part: number): string {
  const head = [
    `Subject: ${lesson.subject} · Grade ${lesson.grade} · ${lesson.unit}`,
    `Lesson ${lesson.code}: ${both(lesson.title)}`,
  ];

  let body: string;
  if (view === "topics") {
    head.push("The student is on: Main Topics (the summary)");
    body = lesson.mainTopics.map((t) => `### ${both(t.title)}\n${t.points.map((p) => `- ${en(p)}`).join("\n")}`).join("\n\n");
  } else {
    const i = Math.min(Math.max(0, part), lesson.sections.length - 1);
    const s = lesson.sections[i];
    head.push(
      `The student is on: ${view === "learn" ? "Learn mode" : "Read all"}, part ${i + 1} of ${lesson.sections.length}: ${s ? both({ en: s.title_en, am: s.title_am }) : ""}`,
    );
    body = s ? s.blocks.map(blockText).filter(Boolean).join("\n\n") : "";
  }
  if (body.length > TUTOR.contextChars) body = body.slice(0, TUTOR.contextChars) + " …";

  return `LESSON CONTEXT\n${head.join("\n")}\n\n${body}`;
}
