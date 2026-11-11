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
// Shared, tested math logic (Node strips the TypeScript types).
const { evalVenn, REGIONS } = await import(new URL("../src/lib/math/venn.ts", import.meta.url).href);
const { canonicalSet } = await import(new URL("../src/lib/math/sets.ts", import.meta.url).href);
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
  // Math-only text ($…$ formulas, numbers) is the same in both languages.
  const words = v.en.replace(/\$[^$]*\$/g, "").replace(/[^A-Za-z]/g, "");
  if (amharic && words.length > 3 && !ETHIOPIC.test(v.am) && v.am === v.en) {
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

/** Venn data: { sets: 2|3, labels?: [...], elements?: { region: [..] } } */
function checkVenn(v, path) {
  if (!v || (v.sets !== 2 && v.sets !== 3)) return fail(path + ".sets", "must be 2 or 3");
  if (v.labels && (!Array.isArray(v.labels) || v.labels.length !== v.sets)) fail(path + ".labels", `needs ${v.sets} labels`);
  for (const k of Object.keys(v.elements ?? {}))
    if (!REGIONS[v.sets].includes(k)) fail(`${path}.elements.${k}`, `unknown region (use ${REGIONS[v.sets].join(", ")})`);
}
function checkShade(expr, venn, path) {
  try {
    evalVenn(expr, venn.sets, venn.labels);
  } catch (e) {
    fail(path, `bad set expression "${expr}": ${e.message}`);
  }
}
function checkSteps(steps, path, venn) {
  if (!Array.isArray(steps) || !steps.length) return fail(path, "needs at least one step");
  steps.forEach((st, i) => {
    isBi(st.text, `${path}[${i}].text`, { amharic: false });
    if (st.why) isBi(st.why, `${path}[${i}].why`, { amharic: false });
    if (st.shade) {
      if (!venn) fail(`${path}[${i}].shade`, "needs a venn on the worked example");
      else checkShade(st.shade, venn, `${path}[${i}].shade`);
    }
  });
}
/** Answer spec (homework + quiz): choice | number | set | venn. Set answers are stored in canonical form. */
function checkAnswer(a, path) {
  if (a?.kind === "choice") {
    if (!Array.isArray(a.options) || a.options.length < 2) fail(path + ".options", "needs 2+ options");
    else a.options.forEach((o, i) => isBi(o, `${path}.options[${i}]`, { amharic: false }));
    if (!Number.isInteger(a.correct) || a.correct < 0 || a.correct >= (a.options?.length ?? 0)) fail(path + ".correct", "bad index");
  } else if (a?.kind === "number") {
    if (typeof a.value !== "number") fail(path + ".value", "must be a number");
  } else if (a?.kind === "set") {
    if (!Array.isArray(a.value)) fail(path + ".value", "must be an array of elements");
    else a.value = canonicalSet(a.value.map(String));
  } else if (a?.kind === "venn") {
    checkVenn(a.venn, path + ".venn");
    if (!Array.isArray(a.regions) || !a.regions.every((r) => REGIONS[a.venn?.sets]?.includes(r))) fail(path + ".regions", "unknown region");
  } else fail(path + ".kind", "must be choice | number | set | venn");
}

function checkBlock(b, path) {
  switch (b?.type) {
    case "venn":
      checkVenn(b.venn, path + ".venn");
      if (b.shade) checkShade(b.shade, b.venn, path + ".shade");
      if (b.caption) isBi(b.caption, path + ".caption", { amharic: false });
      (b.steps ?? []).forEach((st, i) => {
        checkShade(st.shade, b.venn, `${path}.steps[${i}].shade`);
        isBi(st.text, `${path}.steps[${i}].text`, { amharic: false });
      });
      break;
    case "worked":
      isBi(b.title, path + ".title", { amharic: false });
      isBi(b.problem, path + ".problem", { amharic: false });
      if (b.venn) checkVenn(b.venn, path + ".venn");
      checkSteps(b.steps, path + ".steps", b.venn);
      isBi(b.answer, path + ".answer", { amharic: false });
      break;
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
if (qCount < 10 || qCount > 30) fail("quiz.questions", "must have 10-30 questions");
else
  q.questions.forEach((qq, i) => {
    const p = `quiz.questions[${i}]`;
    isBi(qq.question, p + ".question", { amharic: false });
    isBi(qq.explanation, p + ".explanation", { amharic: false });
    (qq.steps ?? []).forEach((st, j) => isBi(st.text, `${p}.steps[${j}].text`, { amharic: false }));
    const kind = qq.kind ?? "choice";
    if (kind === "choice") {
      if (!Array.isArray(qq.options) || qq.options.length < 2 || qq.options.length > 6)
        fail(p + ".options", "must have 2-6 options");
      else qq.options.forEach((o, j) => isBi(o, `${p}.options[${j}]`, { amharic: false }));
      if (!Number.isInteger(qq.answer) || qq.answer < 0 || qq.answer >= (qq.options?.length ?? 0))
        fail(p + ".answer", "must be the 0-based index of the correct option");
    } else {
      const spec = { kind, ...qq.answer };
      checkAnswer(spec, p + ".answer");
      if (kind === "set") qq.answer.value = spec.value;
    }
  });

/* homework + practice (optional, same shape; practice = "Extra practice", never counted as homework): [{ id, type?, question, tip, hints[], answers[{label, spec}], solution{steps, answer, venn?} }]
   ONE question per item; answers = its labelled parts. type: choice | written | venn | open (inferred if missing). */
for (const key of ["homework", "practice"]) {
const hw = data[key] ?? [];
const seen = new Set();
if (!Array.isArray(hw)) fail(key, "must be an array");
else
  hw.forEach((h, i) => {
    const p = `${key}[${i}]`;
    if (seen.has(h.id)) fail(p + ".id", "must be unique");
    seen.add(h.id);
    if (typeof h.id !== "string" || !h.id) fail(p + ".id", "is required");
    const kinds = (h.answers ?? []).map((a) => a?.spec?.kind);
    const inferred = !kinds.length ? "open" : kinds.every((k) => k === "choice") ? "choice" : kinds.some((k) => k === "venn") ? "venn" : "written";
    if (h.type !== undefined && !["choice", "written", "venn", "open"].includes(h.type)) fail(p + ".type", "must be choice | written | venn | open");
    else if (h.type !== undefined && h.type !== inferred) fail(p + ".type", `is "${h.type}" but the answers make it "${inferred}"`);
    if (inferred !== "venn" && kinds.includes("venn")) fail(p + ".answers", "do not mix Venn shading with other answer types in one question");
    isBi(h.question, p + ".question", { amharic: false });
    isBi(h.tip, p + ".tip", { amharic: false });
    (h.hints ?? []).forEach((x, j) => isBi(x, `${p}.hints[${j}]`, { amharic: false }));
    if (h.warmup !== undefined && typeof h.warmup !== "boolean") fail(p + ".warmup", "must be true or false");
    if (h.figure) {
      checkVenn(h.figure.venn, p + ".figure.venn");
      if (h.figure.caption) isBi(h.figure.caption, p + ".figure.caption", { amharic: false });
    }
    (h.compare ?? []).forEach((c, j) => {
      if (!h.figure) fail(p + ".compare", "needs a figure");
      isBi(c.label, `${p}.compare[${j}].label`, { amharic: false });
      if (h.figure) checkShade(c.shade, h.figure.venn, `${p}.compare[${j}].shade`);
    });
    (h.answers ?? []).forEach((a, j) => {
      isBi(a.label, `${p}.answers[${j}].label`, { amharic: false });
      if (a.group) isBi(a.group, `${p}.answers[${j}].group`, { amharic: false });
      checkAnswer(a.spec, `${p}.answers[${j}].spec`);
    });
    if (h.solution?.venn) checkVenn(h.solution.venn, p + ".solution.venn");
    checkSteps(h.solution?.steps, p + ".solution.steps", h.solution?.venn);
    isBi(h.solution?.answer, p + ".solution.answer", { amharic: false });
  });
}
if ((data.practice ?? []).some((x) => (data.homework ?? []).some((h) => h.id === x.id))) fail("practice", "ids must differ from the homework ids");

if (errors.length) {
  console.error(`✗ ${file} has ${errors.length} problem(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
for (const w of warnings) console.error(`  ! ${w}`);

/* ---------------- SQL generation ---------------- */

const lit = (s) => `'${String(s).replaceAll("'", "''")}'`;
const json = (v) => `${lit(JSON.stringify(v))}::jsonb`;
const arr = (xs) => (xs.length ? `array[${xs.map(lit).join(", ")}]::text[]` : "'{}'::text[]");
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
    minutes = ${l.minutes}, main_topics = ${json(data.main_topics)}, glossary = ${json(data.glossary)},
    homework = ${json(data.homework ?? [])}, practice = ${json(data.practice ?? [])}`;

if (UPDATE) {
  out.push(`  -- Never overwrite a lesson that was edited in the admin dashboard (it has saved versions or a draft).
  if exists (
    select 1 from public.lessons l
     where l.unit_id = v_unit_id and l.code = ${lit(l.code)}
       and (exists (select 1 from public.lesson_versions v where v.lesson_id = l.id)
            or exists (select 1 from public.lesson_drafts d where d.lesson_id = l.id))
  ) then
    raise exception 'Lesson ${l.code} was edited in the admin dashboard; edit it there instead of overwriting it';
  end if;

  -- Update an existing lesson in place: replace its fields, note parts and quiz.
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
  insert into public.lessons (unit_id, code, slug, sort_order, title_en, title_am) values (v_unit_id, ${lit(l.code)}, ${lit(l.slug)}, ${l.sort_order}, '', '')
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
  "  insert into public.quiz_questions (quiz_id, sort_order, kind, question_en, question_am, options_en, options_am, correct_index, answer, steps, explanation_en, explanation_am) values",
);
out.push(
  q.questions
    .map(
      (qq, i) =>
        `    (v_quiz_id, ${i + 1}, ${lit(qq.kind ?? "choice")}, ${lit(qq.question.en)}, ${lit(qq.question.am)},\n     ${arr((qq.options ?? []).map((o) => o.en))},\n     ${arr((qq.options ?? []).map((o) => o.am))},\n     ${(qq.kind ?? "choice") === "choice" ? qq.answer : 0}, ${(qq.kind ?? "choice") === "choice" ? "null" : json(qq.answer)}, ${json(qq.steps ?? [])},\n     ${lit(qq.explanation.en)}, ${lit(qq.explanation.am)})`,
    )
    .join(",\n") + ";",
);
out.push("end");
out.push("$migration$;");
out.push("");

process.stdout.write(out.join("\n"));
console.error(
  `✓ ${l.code} ${l.title.en}: ${data.sections.length} parts, ${data.glossary.length} key terms, ${data.main_topics.length} main topics, ${qCount} quiz questions, ${(data.homework ?? []).length} homework, ${(data.practice ?? []).length} extra practice`,
);
