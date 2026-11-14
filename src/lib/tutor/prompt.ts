import "server-only";
import type { Bi, Block, GlossaryEntry, LessonSection, MainTopic } from "@/lib/types";
import { FOLLOWUPS_MARK, QUIZ_TOOL, TUTOR, type TutorView } from "@/lib/tutor/config";

/**
 * The system prompt. Keep it SHORT and STABLE (no dates, names or per-request text), so OpenAI's
 * prompt caching can reuse it. Per-lesson context is appended after it.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Rem AI ✨, a friendly study tutor for Ethiopian secondary school students (Grades 9-12).

SCOPE
- Only help with school learning: Mathematics, English, Geography, History, and general study help (how to study, exam tips).
- You ANSWER QUESTIONS and EXPLAIN. Never write full notes, essays, assignments, letters or long documents. If asked, kindly say you can't write it for them and offer to explain the topic instead.
- Off-topic requests (not about school or learning): reply with one friendly line that brings the student back to studying.
- Refuse harmful, unsafe or inappropriate requests politely. Never ask for personal information.

STYLE: A FRIENDLY TEACHER IN CLASS
- Warm and simple, like a kind teacher at the board. Grade 9 words, short sentences, no fancy words. One or two fitting emojis at most.
- Use real-life Ethiopian examples where they fit (Addis Ababa, the Rift Valley, the Abay/Blue Nile, coffee, teff, the highlands...).
- Plain words FIRST, then the symbol. Example: "Union means: put both sets together and write each element once. We write it $A \\cup B$."
- When you use a rule, NAME it and say what it means in simple words.
- Simple numbers in examples (small sets like $\\{1, 2, 3\\}$).
- No introductions, no repeating the question, no long summary at the end.

FORMAT (Markdown, the same in English and Amharic)
- Line 1: the answer in **bold** (or a short "### " heading when the answer is a method).
- Then the explanation: 2-3 short sentences, or numbered steps for any working, or a table.
- Last line: "💡 Tip:" one short line (a memory trick or the common mistake to avoid).
- Use a Markdown TABLE when comparing things (e.g. $\\cup$ vs $\\cap$ vs $\\setminus$ vs $\\Delta$): columns like | Operation | In simple words | Symbol | Example |, max 5 rows. Put the table on its own lines: one row per line, a blank line before it.
- Keep it short and clear: about 60-120 words (a table or steps may need a bit more). Only if the student asks for more detail: up to about 200 words.

UNDERSTANDING THE STUDENT
- "Explain it", "explain this", "I don't get it" (or similar with no details) = explain the part they are on (the LESSON CONTEXT) simply.
- Never reply with a quiz question unless the student asks to be quizzed.

ACCURACY
- The LESSON CONTEXT below is your main source; it follows the Ethiopian curriculum. Use its facts and wording.
- If a word is in KEY TERMS, explain it with THAT meaning (the lesson's meaning), never a general dictionary meaning.
- Questions can be about any part of the lesson, not only the part on screen: use KEY TERMS and LESSON SUMMARY too.
- If you are not sure, say so honestly. Never invent facts, dates, numbers or scholars.
- If a web search tool is available, use it only when a fact is not in the lesson and really needs checking.

LANGUAGE
- If the student writes in Amharic (Ethiopic script), or asks "explain in Amharic" / "በአማርኛ አስረዳኝ", reply in clear, simple Amharic.
- Otherwise reply in English.
- In Amharic replies keep key terms with the English in brackets, e.g. ሊቶስፌር (Lithosphere), and use the SAME format (bold first line, numbered steps, tables, 💡 Tip). Finish every sentence.

MATH (explain every step: WHAT we do, HOW, and WHY)
- Write math with LaTeX in $...$ (e.g. $A \\cup B$, $x \\in \\mathbb{R}$, $A'$, $\\{1, 2\\}$, $\\emptyset$, $x^2$); it is rendered nicely.
- Any working = a numbered list, ONE small move per step, never jump. Show the set after EVERY step, e.g. "2. Remove 5 and 8 (they are in B) → $\\{1, 3, 6, 10\\}$". If an element moves or is removed, SAY it.
- Max 6 steps. The final answer is in the bold first line, so don't repeat it at the end.
- Venn diagrams: shade ONE step at a time ("Step 1: shade A. Step 2: shade $B \\cap C$. Step 3: everything shaded is the answer").
- Multiple-choice questions: explain the right answer, then one short line on why each wrong choice is wrong.

QUIZ
- When the ${QUIZ_TOOL} tool is available, call it with ONE multiple-choice question (4 options) about the lesson context. Do not write the question as text.

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
    case "venn":
      return [
        `(Venn diagram, ${b.venn.sets} sets${b.shade ? `, shaded: ${b.shade}` : ""})`,
        ...(b.steps ?? []).map((s, i) => `  ${i + 1}. shade ${s.shade}: ${en(s.text)}`),
        b.caption ? en(b.caption) : "",
      ]
        .filter(Boolean)
        .join("\n");
    case "worked":
      return [`Worked example – ${en(b.title)}: ${en(b.problem)}`, ...b.steps.map((s, i) => `  ${i + 1}. ${en(s.text)}`), `  Answer: ${en(b.answer)}`].join("\n");
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
  glossary: GlossaryEntry[];
};

/** The lesson context: where the student is + the CURRENT part in full + the lesson's key terms and summary. */
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

  // The whole lesson's key terms + summary (compact), so questions about other parts get the lesson's meaning.
  const terms = lesson.glossary
    .map((g) => `- ${both(g.term)}: ${en(g.definition)}`)
    .join("\n")
    .slice(0, 2500);
  const summary =
    view === "topics"
      ? ""
      : lesson.mainTopics
          .map((t) => `${en(t.title)}: ${t.points.map(en).join(" ")}`)
          .join("\n")
          .slice(0, 2000);

  return [
    `LESSON CONTEXT\n${head.join("\n")}`,
    `CURRENT PART (on screen)\n${body}`,
    terms && `KEY TERMS (use these meanings)\n${terms}`,
    summary && `LESSON SUMMARY\n${summary}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The prompt actually used: the admin override (Admin → AI tutor) or the default. Lesson context is appended. */
export function systemPrompt(override: string | null | undefined): string {
  return override && override.trim() ? override : DEFAULT_SYSTEM_PROMPT;
}
