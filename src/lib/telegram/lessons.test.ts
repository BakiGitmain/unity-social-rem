import { test } from "node:test";
import assert from "node:assert/strict";
import { TG_LIMITS } from "./format.ts";
import { findLesson, lessonPath, newLessons, pickQuiz, toPoll, type BotLesson, type QuizRow } from "./lessons.ts";

const lesson = (id: string, key: string, createdAt: string, code = "1.1"): BotLesson => ({
  id,
  key,
  code,
  title: { en: `Lesson ${code}`, am: `ትምህርት ${code}` },
  summary: { en: "", am: "" },
  subject: { slug: key.split("/")[0]!, name: { en: "", am: "" } },
  grade: 9,
  unit: { en: "Unit 1", am: "ምዕራፍ 1" },
  createdAt,
  homeworkCount: 0,
  homeworkIds: [],
  quizCount: 0,
  minutes: null,
});

const GEO1 = lesson("g1", "geography/grade-9/unit-1/1-1-1", "2026-11-09T19:48:51Z", "1.1.1");
const GEO2 = lesson("g2", "geography/grade-9/unit-1/1-1-2", "2026-11-09T19:48:52Z", "1.1.2");
const MATH = lesson("m1", "mathematics/grade-9/unit-1/1-1", "2026-11-11T14:55:32Z", "1.1");
const HIST = lesson("h1", "history/grade-9/unit-1/1-1", "2026-11-20T08:00:00Z", "1.1");

test("new-lesson diff: only lessons never announced", () => {
  assert.deepEqual(newLessons([GEO1, GEO2, MATH], new Set(["g1", "g2", "m1"])), []);
  assert.deepEqual(newLessons([GEO1, GEO2, MATH, HIST], new Set(["g1", "g2", "m1"])).map((l) => l.id), ["h1"]);
});

test("new-lesson diff: oldest first (teaching order), stable for equal times", () => {
  const twin = lesson("g3", "geography/grade-9/unit-1/1-1-3", GEO2.createdAt, "1.1.3");
  assert.deepEqual(newLessons([HIST, twin, MATH, GEO2], new Set()).map((l) => l.id), ["g2", "g3", "m1", "h1"]);
});

test("new-lesson diff: by lesson id, so renaming a slug does not announce it again", () => {
  const renamed = { ...MATH, key: "mathematics/grade-9/unit-1/sets" };
  assert.deepEqual(newLessons([renamed], new Set(["m1"])), []);
});

test("lesson paths have no locale and can open a tab", () => {
  assert.equal(lessonPath(MATH), "/mathematics/grade-9/unit-1/1-1");
  assert.equal(lessonPath(MATH, "homework"), "/mathematics/grade-9/unit-1/1-1?tab=homework");
});

test("/notify finds a lesson by full path, by 'subject code' and reports ambiguous slugs", () => {
  const all = [GEO1, GEO2, MATH, HIST];
  assert.equal(findLesson(all, "mathematics/grade-9/unit-1/1-1"), MATH);
  assert.equal(findLesson(all, "/geography/grade-9/unit-1/1-1-2/"), GEO2);
  assert.equal(findLesson(all, "geography 1.1.1"), GEO1);
  assert.equal(findLesson(all, "math 1.1"), MATH);
  assert.equal(findLesson(all, "1.1.2"), GEO2);
  const amb = findLesson(all, "1-1");
  assert.ok(Array.isArray(amb) && amb.length === 2); // math and history are both "1-1"
  assert.equal(findLesson(all, "physics 2.1"), null);
  assert.equal(findLesson(all, ""), null);
});

const q = (over: Partial<QuizRow> = {}): QuizRow => ({
  id: "q1",
  kind: "choice",
  question_en: "If $A = \\{1, 2, 3\\}$ and $B = \\{2, 3, 4\\}$, what is $A \\cap B$?",
  question_am: "$A = \\{1, 2, 3\\}$ እና $B = \\{2, 3, 4\\}$ ከሆኑ $A \\cap B$ ምንድን ነው?",
  options_en: ["$\\{2, 3\\}$", "$\\{1, 4\\}$", "$\\emptyset$", "$\\{1, 2, 3, 4\\}$"],
  options_am: ["$\\{2, 3\\}$", "$\\{1, 4\\}$", "$\\emptyset$", "$\\{1, 2, 3, 4\\}$"],
  correct_index: 0,
  explanation_en: "**Both** sets have 2 and 3.",
  explanation_am: "ሁለቱም ስብስቦች 2 እና 3 አላቸው።",
  ...over,
});

test("quiz poll: math becomes plain Unicode, numbered, in the chosen language", () => {
  const en = toPoll(q(), "en", { i: 2, total: 5 })!;
  assert.equal(en.question, "2/5 · If A = {1, 2, 3} and B = {2, 3, 4}, what is A ∩ B?");
  assert.deepEqual(en.options, ["{2, 3}", "{1, 4}", "∅", "{1, 2, 3, 4}"]);
  assert.equal(en.correct, 0);
  assert.equal(en.explanation, "Both sets have 2 and 3.");
  const am = toPoll(q(), "am")!;
  assert.match(am.question, /ምንድን ነው\?$/);
  assert.equal(am.explanation, "ሁለቱም ስብስቦች 2 እና 3 አላቸው።");
});

test("quiz poll: only choice questions; lengths fit Telegram's limits", () => {
  assert.equal(toPoll(q({ kind: "set", options_en: [], options_am: [] }), "en"), null);
  assert.equal(toPoll(q({ options_en: ["x".repeat(101), "b"], options_am: ["a", "b"] }), "en"), null);
  assert.equal(toPoll(q({ correct_index: 7 }), "en"), null);
  const long = toPoll(q({ question_en: "Why? ".repeat(100), explanation_en: "Because. ".repeat(60) }), "en")!;
  assert.ok([...long.question].length <= TG_LIMITS.pollQuestion);
  assert.ok([...long.explanation].length <= TG_LIMITS.pollExplanation);
  assert.ok(long.explanation.endsWith("…"));
});

test("pickQuiz: n questions that work as polls, shuffled", () => {
  const rows = [q({ id: "a" }), q({ id: "b", kind: "number" }), q({ id: "c" }), q({ id: "d" }), q({ id: "e" })];
  const picked = pickQuiz(rows, 3, () => 0);
  assert.equal(picked.length, 3);
  assert.ok(picked.every((r) => r.id !== "b"));
  assert.equal(new Set(picked.map((r) => r.id)).size, 3);
  assert.equal(pickQuiz(rows, 10).length, 4);
});
