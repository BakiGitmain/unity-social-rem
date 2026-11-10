#!/usr/bin/env node
/**
 * Turns a lesson JSON file (content/lessons/...) into the SQL for ONE migration.
 *
 *   node scripts/lesson-to-sql.mjs content/lessons/geography/grade-9/unit-1/1-1-1.json > supabase/migrations/<file>.sql
 *   node scripts/lesson-to-sql.mjs --update <file.json> > ...   (lesson already pushed: replace its content in place)
 *
 * It validates the JSON first and exits non-zero (printing every problem) if anything is wrong.
 * See ADD_LESSON.md for the format and the full workflow.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const UPDATE = process.argv.includes("--update");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage: node scripts/lesson-to-sql.mjs [--update] <lesson.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(file, "utf8"));
const errors = [];
const warnings = [];
const fail = (path, msg) => errors.push(`${path}: ${msg}`);

/* ---------------- validation ---------------- */

const SUBJECTS = ["mathematics", "english", "geography", "history"];
const ICONS = JSON.parse(readFileSync(join(process.cwd(), "src/lib/icon-names.json"), "utf8"));
const ETHIOPIC = /[ሀ-፿]/;
const MAX_BLOCKS_PER_PART = 6;

function isBi(v, path, { amharic = true } = {}) {
  if (!v || typeof v !== "object" || typeof v.en !== "string" || typeof v.am !== "string") {
    fail(path, "must be { en: string, am: string }");
    return false;
  }
  if (!v.en.trim()) fail(path + ".en", "is empty");
  if (!v.am.trim()) fail(path + ".am", "is empty");
  if (amharic && v.en.length > 3 && !ETHIOPIC.test(v.am) && v.am === v.en) {
    fail(path + ".am", "looks untranslated (identical to English)");
  }
  const odd = (s) => (s.match(/\*\*/g) || []).length % 2;
  if (odd(v.en)) fail(path + ".en", "has an unclosed ** highlight");
  if (odd(v.am)) fail(path + ".am", "has an unclosed ** highlight");
  return true;
}

const icon = (name, path) => {
  if (!ICONS.includes(name)) fail(path, `unknown icon "${name}" (see src/lib/icon-names.json)`);
};

function checkBlock(b, path) {
  switch (b?.type) {
    case "heading":
    case "paragraph":
      isBi(b.text, path + ".text");
      break;
    case "keypoint":
      if (b.variant && !["definition", "important", "note"].includes(b.variant))
        fail(path + ".variant", "must be definition | important | note");
      if (b.icon) icon(b.icon, path + ".icon");
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
      else {
        if (b.items.length > 6) fail(path + ".items", "max 6 items (split it into another part)");
        b.items.forEach((it, i) => isBi(it, `${path}.items[${i}]`));
      }
      break;
    case "points":
      if (!Array.isArray(b.items) || b.items.length < 2 || b.items.length > 6)
        fail(path + ".items", "must have 2-6 items");
      else
        b.items.forEach((it, i) => {
          icon(it.icon, `${path}.items[${i}].icon`);
          isBi(it.title, `${path}.items[${i}].title`);
          isBi(it.text, `${path}.items[${i}].text`);
        });
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
      isBi(b.alt, path + ".alt");
      if (b.caption) isBi(b.caption, path + ".caption");
      if (typeof b.credit !== "string" || !b.credit.trim()) fail(path + ".credit", "is required (license/credit line)");
      if (!b.creditUrl) fail(path + ".creditUrl", "is required: link to the image's source/license page");
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

const q = data.quiz ?? {};
const qCount = Array.isArray(q.questions) ? q.questions.length : 0;

if (!Array.isArray(data.sections) || !data.sections.length) fail("sections", "must be a non-empty array");
else
  data.sections.forEach((s, i) => {
    const p = `sections[${i}]`;
    isBi(s.title, `${p}.title`);
    icon(s.icon, `${p}.icon`);
    if (!Array.isArray(s.blocks) || !s.blocks.length) fail(`${p}.blocks`, "must be a non-empty array");
    else {
      if (s.blocks.length > MAX_BLOCKS_PER_PART)
        fail(`${p}.blocks`, `has ${s.blocks.length} blocks; one part = one concept, max ${MAX_BLOCKS_PER_PART} blocks`);
      s.blocks.forEach((b, j) => checkBlock(b, `${p}.blocks[${j}]`));
    }
    if ("checks" in s) fail(`${p}.checks`, "Learn mode has no quick checks between parts; remove this field");
  });

if (!Array.isArray(data.glossary) || data.glossary.length < 3) fail("glossary", "needs at least 3 key-term definitions");
else
  data.glossary.forEach((g, i) => {
    isBi(g.term, `glossary[${i}].term`);
    isBi(g.definition, `glossary[${i}].definition`);
    const allText = JSON.stringify(data.sections).toLowerCase();
    if (g.term?.en && !allText.includes(g.term.en.toLowerCase()))
      warnings.push(`glossary[${i}] "${g.term.en}" never appears in the notes, so no popover will show`);
  });

if (!Array.isArray(data.main_topics) || !data.main_topics.length) fail("main_topics", "must be a non-empty array");
else
  data.main_topics.forEach((t, i) => {
    isBi(t.title, `main_topics[${i}].title`);
    if (!Array.isArray(t.points) || !t.points.length) fail(`main_topics[${i}].points`, "must be a non-empty array");
    else t.points.forEach((p, j) => isBi(p, `main_topics[${i}].points[${j}]`));
  });

isBi(q.title, "quiz.title");
if (q.description) isBi(q.description, "quiz.description");
if (qCount < 10 || qCount > 20) fail("quiz.questions", "must have 10-20 questions");
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
for (const w of warnings) console.error(`  ! ${w}`);

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

const lessonFields = `slug = ${lit(l.slug)}, sort_order = ${l.sort_order}, section_code = ${lit(l.section?.code ?? "")},
    section_title_en = ${bi(l.section?.title, "en")}, section_title_am = ${bi(l.section?.title, "am")},
    title_en = ${bi(l.title, "en")}, title_am = ${bi(l.title, "am")},
    summary_en = ${bi(l.summary, "en")}, summary_am = ${bi(l.summary, "am")},
    minutes = ${l.minutes}, main_topics = ${json(data.main_topics)}, glossary = ${json(data.glossary)}`;

if (UPDATE) {
  out.push(`  -- Update an existing lesson in place: replace its fields, note parts and quiz.
  update public.lessons set
    ${lessonFields}
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
  end if;
  insert into public.lessons (unit_id, code, title_en, title_am) values (v_unit_id, ${lit(l.code)}, '', '')
  returning id into v_lesson_id;
  update public.lessons set
    ${lessonFields}
  where id = v_lesson_id;`);
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
  `✓ ${l.code} ${l.title.en}: ${data.sections.length} parts, ${data.glossary.length} key terms, ${data.main_topics.length} main topics, ${qCount} quiz questions`,
);
