#!/usr/bin/env node
/**
 * Turns a lesson JSON file (content/lessons/...) into the SQL for ONE migration.
 *
 *   node scripts/lesson-to-sql.mjs content/lessons/geography/grade-9/unit-1/1-1-1.json > supabase/migrations/<file>.sql
 *
 * It validates the JSON first and exits non-zero (printing every problem) if anything is wrong.
 * The SQL creates the unit if it is missing, refuses to insert a lesson that already exists,
 * and inserts the lesson, its note sections, main topics, quiz and quiz questions.
 * See ADD_LESSON.md for the full workflow.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// --update: the lesson already exists; replace its content in place (for fixes to pushed lessons).
const UPDATE = process.argv.includes("--update");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage: node scripts/lesson-to-sql.mjs [--update] <lesson.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(file, "utf8"));
const errors = [];
const fail = (path, msg) => errors.push(`${path}: ${msg}`);

/* ---------------- validation ---------------- */

const SUBJECTS = ["mathematics", "english", "geography", "history"];
const ICONS = [
  "book-open", "languages", "quote", "sparkles", "flask-conical", "git-branch", "mountain",
  "users", "layers", "globe", "history", "target", "lightbulb", "scroll-text", "compass",
  "map", "list-checks",
];
const ETHIOPIC = /[ሀ-፿]/;

function isBi(v, path, { amharic = true } = {}) {
  if (!v || typeof v !== "object" || typeof v.en !== "string" || typeof v.am !== "string") {
    fail(path, "must be { en: string, am: string }");
    return false;
  }
  if (!v.en.trim()) fail(path + ".en", "is empty");
  if (!v.am.trim()) fail(path + ".am", "is empty");
  // Amharic text must actually contain Ethiopic script (catches untranslated copies),
  // unless it is something like a number or a name that is the same in both.
  if (amharic && v.en.length > 3 && !ETHIOPIC.test(v.am) && v.am === v.en) {
    fail(path + ".am", "looks untranslated (identical to English)");
  }
  const stars = (s) => (s.match(/\*\*/g) || []).length % 2;
  if (stars(v.en)) fail(path + ".en", "has an unclosed ** highlight");
  if (stars(v.am)) fail(path + ".am", "has an unclosed ** highlight");
  return true;
}

function checkBlock(b, path) {
  switch (b?.type) {
    case "heading":
    case "paragraph":
      isBi(b.text, path + ".text");
      break;
    case "keypoint":
      if (b.variant && !["definition", "important", "note"].includes(b.variant))
        fail(path + ".variant", "must be definition | important | note");
      isBi(b.title, path + ".title");
      isBi(b.text, path + ".text");
      break;
    case "example":
    case "tip":
      isBi(b.title, path + ".title");
      isBi(b.text, path + ".text");
      break;
    case "list":
    case "terms":
      if (b.type === "terms") isBi(b.title, path + ".title");
      if (!Array.isArray(b.items) || !b.items.length) fail(path + ".items", "must be a non-empty array");
      else b.items.forEach((it, i) => isBi(it, `${path}.items[${i}]`));
      break;
    case "table":
      if (b.caption) isBi(b.caption, path + ".caption");
      if (!Array.isArray(b.headers) || !b.headers.length) fail(path + ".headers", "must be a non-empty array");
      else b.headers.forEach((h, i) => isBi(h, `${path}.headers[${i}]`, { amharic: false }));
      if (!Array.isArray(b.rows) || !b.rows.length) fail(path + ".rows", "must be a non-empty array");
      else
        b.rows.forEach((r, i) => {
          if (!Array.isArray(r) || r.length !== b.headers.length)
            fail(`${path}.rows[${i}]`, `must have ${b.headers.length} cells`);
          else r.forEach((c, j) => isBi(c, `${path}.rows[${i}][${j}]`, { amharic: false }));
        });
      break;
    case "image":
      if (typeof b.src !== "string" || !(b.src.startsWith("/") || b.src.startsWith("https://")))
        fail(path + ".src", "must be a /public path or an https URL");
      else if (b.src.startsWith("/") && !existsSync(join(process.cwd(), "public", b.src)))
        fail(path + ".src", `file public${b.src} does not exist`);
      if (!b.creditUrl) fail(path + ".creditUrl", "is required: link to the image's source/license page");
      if (!(b.width > 0 && b.height > 0)) fail(path, "needs width and height");
      isBi(b.alt, path + ".alt");
      if (b.caption) isBi(b.caption, path + ".caption");
      if (typeof b.credit !== "string" || !b.credit.trim()) fail(path + ".credit", "is required (license/credit line)");
      break;
    default:
      fail(path + ".type", `unknown block type "${b?.type}"`);
  }
}

if (!SUBJECTS.includes(data.subject)) fail("subject", `must be one of ${SUBJECTS.join(", ")}`);
if (!Number.isInteger(data.grade)) fail("grade", "must be an integer");

const u = data.unit ?? {};
if (!Number.isInteger(u.number)) fail("unit.number", "must be an integer");
if (!/^[a-z0-9-]+$/.test(u.slug ?? "")) fail("unit.slug", "must be kebab-case, e.g. unit-1");
isBi(u.label, "unit.label");
isBi(u.title, "unit.title");
if (u.description) isBi(u.description, "unit.description");

const l = data.lesson ?? {};
if (!/^[0-9]+(\.[0-9]+)*$/.test(l.code ?? "")) fail("lesson.code", "must look like 1.1.1");
if (l.slug !== (l.code ?? "").replaceAll(".", "-")) fail("lesson.slug", `must be "${(l.code ?? "").replaceAll(".", "-")}"`);
if (!Number.isInteger(l.sort_order)) fail("lesson.sort_order", "must be an integer");
if (!Number.isInteger(l.minutes)) fail("lesson.minutes", "must be an integer");
if (l.section) {
  if (typeof l.section.code !== "string") fail("lesson.section.code", "must be a string");
  isBi(l.section.title, "lesson.section.title");
}
isBi(l.title, "lesson.title");
isBi(l.summary, "lesson.summary");

if (!Array.isArray(data.sections) || !data.sections.length) fail("sections", "must be a non-empty array");
else
  data.sections.forEach((s, i) => {
    isBi(s.title, `sections[${i}].title`);
    if (!ICONS.includes(s.icon)) fail(`sections[${i}].icon`, `must be one of ${ICONS.join(", ")}`);
    if (!Array.isArray(s.blocks) || !s.blocks.length) fail(`sections[${i}].blocks`, "must be a non-empty array");
    else s.blocks.forEach((b, j) => checkBlock(b, `sections[${i}].blocks[${j}]`));
  });

if (!Array.isArray(data.main_topics) || !data.main_topics.length) fail("main_topics", "must be a non-empty array");
else
  data.main_topics.forEach((t, i) => {
    isBi(t.title, `main_topics[${i}].title`);
    if (!Array.isArray(t.points) || !t.points.length) fail(`main_topics[${i}].points`, "must be a non-empty array");
    else t.points.forEach((p, j) => isBi(p, `main_topics[${i}].points[${j}]`));
  });

const q = data.quiz ?? {};
isBi(q.title, "quiz.title");
if (q.description) isBi(q.description, "quiz.description");
if (!Array.isArray(q.questions) || q.questions.length < 10 || q.questions.length > 20)
  fail("quiz.questions", "must have 10-20 questions");
else
  q.questions.forEach((qq, i) => {
    const p = `quiz.questions[${i}]`;
    isBi(qq.question, p + ".question");
    isBi(qq.explanation, p + ".explanation");
    if (!Array.isArray(qq.options) || qq.options.length < 2 || qq.options.length > 6)
      fail(p + ".options", "must have 2-6 options");
    else qq.options.forEach((o, j) => isBi(o, `${p}.options[${j}]`, { amharic: false }));
    if (!Number.isInteger(qq.answer) || qq.answer < 0 || qq.answer >= (qq.options?.length ?? 0))
      fail(p + ".answer", "must be the 0-based index of the correct option");
  });

if (errors.length) {
  console.error(`✗ ${file} has ${errors.length} problem(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}

/* ---------------- SQL generation ---------------- */

const lit = (s) => `'${String(s).replaceAll("'", "''")}'`;
const json = (v) => `${lit(JSON.stringify(v))}::jsonb`;
const arr = (xs) => `array[${xs.map(lit).join(", ")}]::text[]`;
const bi = (v, f) => (v ? lit(v[f]) : "''");

const out = [];
out.push(`-- ${UPDATE ? "UPDATE lesson" : "Lesson"} ${l.code} ${l.title.en}`);
out.push(`-- ${data.subject} / grade ${data.grade} / ${u.label.en}`);
out.push(`-- Generated from ${file.replaceAll("\\", "/")} by scripts/lesson-to-sql.mjs. Do not edit by hand.`);
out.push("");
out.push("do $migration$");
out.push("declare");
out.push("  v_grade_id  uuid;");
out.push("  v_unit_id   uuid;");
out.push("  v_lesson_id uuid;");
out.push("  v_quiz_id   uuid;");
out.push("begin");
out.push(`  select g.id into v_grade_id
    from public.grades g join public.subjects s on s.id = g.subject_id
   where s.slug = ${lit(data.subject)} and g.number = ${data.grade};
  if v_grade_id is null then
    raise exception 'Grade ${data.grade} of subject ${data.subject} does not exist';
  end if;`);
out.push("");
out.push(`  -- Create the unit if it does not exist yet.
  insert into public.units (grade_id, number, slug, label_en, label_am, title_en, title_am, description_en, description_am)
  values (v_grade_id, ${u.number}, ${lit(u.slug)}, ${bi(u.label, "en")}, ${bi(u.label, "am")}, ${bi(u.title, "en")}, ${bi(u.title, "am")}, ${bi(u.description, "en")}, ${bi(u.description, "am")})
  on conflict (grade_id, number) do nothing;
  select id into v_unit_id from public.units where grade_id = v_grade_id and number = ${u.number};`);
out.push("");
if (UPDATE) {
  out.push(`  -- Update an existing lesson in place: replace its fields, note sections and quiz.
  update public.lessons set
    slug = ${lit(l.slug)}, sort_order = ${l.sort_order}, section_code = ${lit(l.section?.code ?? "")},
    section_title_en = ${bi(l.section?.title, "en")}, section_title_am = ${bi(l.section?.title, "am")},
    title_en = ${bi(l.title, "en")}, title_am = ${bi(l.title, "am")},
    summary_en = ${bi(l.summary, "en")}, summary_am = ${bi(l.summary, "am")},
    minutes = ${l.minutes}, main_topics = ${json(data.main_topics)}
  where unit_id = v_unit_id and code = ${lit(l.code)}
  returning id into v_lesson_id;
  if v_lesson_id is null then
    raise exception 'Lesson ${l.code} does not exist yet; add it without --update';
  end if;
  delete from public.lesson_sections where lesson_id = v_lesson_id;
  delete from public.quizzes where lesson_id = v_lesson_id;`);
} else {
  out.push(`  -- Never duplicate a lesson.
  if exists (select 1 from public.lessons where unit_id = v_unit_id and code = ${lit(l.code)}) then
    raise exception 'Lesson ${l.code} already exists in this unit';
  end if;`);
  out.push("");
  out.push(`  insert into public.lessons (unit_id, code, slug, sort_order, section_code, section_title_en, section_title_am,
                              title_en, title_am, summary_en, summary_am, minutes, main_topics)
  values (v_unit_id, ${lit(l.code)}, ${lit(l.slug)}, ${l.sort_order}, ${lit(l.section?.code ?? "")}, ${bi(l.section?.title, "en")}, ${bi(l.section?.title, "am")},
          ${bi(l.title, "en")}, ${bi(l.title, "am")}, ${bi(l.summary, "en")}, ${bi(l.summary, "am")}, ${l.minutes},
          ${json(data.main_topics)})
  returning id into v_lesson_id;`);
}
out.push("");
out.push("  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks) values");
out.push(
  data.sections
    .map(
      (s, i) =>
        `    (v_lesson_id, ${i + 1}, ${lit(s.title.en)}, ${lit(s.title.am)}, ${lit(s.icon)},\n     ${json(s.blocks)})`,
    )
    .join(",\n") + ";",
);
out.push("");
out.push(`  insert into public.quizzes (lesson_id, title_en, title_am, description_en, description_am)
  values (v_lesson_id, ${bi(q.title, "en")}, ${bi(q.title, "am")}, ${bi(q.description, "en")}, ${bi(q.description, "am")})
  returning id into v_quiz_id;`);
out.push("");
out.push(
  "  insert into public.quiz_questions (quiz_id, sort_order, question_en, question_am, options_en, options_am, correct_index, explanation_en, explanation_am) values",
);
out.push(
  q.questions
    .map(
      (qq, i) =>
        `    (v_quiz_id, ${i + 1}, ${lit(qq.question.en)}, ${lit(qq.question.am)},\n     ${arr(qq.options.map((o) => o.en))},\n     ${arr(qq.options.map((o) => o.am))},\n     ${qq.answer}, ${lit(qq.explanation.en)}, ${lit(qq.explanation.am)})`,
    )
    .join(",\n") + ";",
);
out.push("end");
out.push("$migration$;");
out.push("");

process.stdout.write(out.join("\n"));
console.error(
  `✓ ${l.code} ${l.title.en}: ${data.sections.length} sections, ${data.main_topics.length} main topics, ${q.questions.length} quiz questions`,
);
