import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalSet, checkSetAnswer, parseSetAnswer } from "./sets.ts";
import { elementsOf, evalVenn, sameRegions } from "./venn.ts";
import { checkNumberAnswer, evaluate, toFraction } from "./calc.ts";

/* ---------------- set answers ---------------- */

test("set checker: order, duplicates and spaces don't matter", () => {
  assert.equal(checkSetAnswer("{1, 0, -1}", ["-1", "0", "1"]).correct, true);
  assert.equal(checkSetAnswer("{ 1,1, 0 ,  −1 }", ["-1", "0", "1"]).correct, true, "duplicates + unicode minus");
  assert.equal(checkSetAnswer("1,0,-1", ["-1", "0", "1"]).correct, true, "braces optional");
  assert.equal(checkSetAnswer("{A, b}", ["a", "B"]).correct, true, "letters ignore case");
});

test("set checker: ∅, { } and 'empty' mean the empty set", () => {
  for (const v of ["∅", "{}", "{ }", "Ø", "empty"]) assert.equal(checkSetAnswer(v, []).correct, true, v);
  assert.deepEqual(parseSetAnswer("∅"), { ok: true, elements: [] });
  assert.equal(checkSetAnswer("{0}", []).correct, false, "{0} is not empty");
  assert.equal(checkSetAnswer("∅", ["0"]).message, "This set is not empty.");
});

test("set checker: friendly feedback", () => {
  assert.equal(checkSetAnswer("{1, 2}", ["1", "2", "3"]).message, "Almost! You're missing 1 element.");
  assert.equal(checkSetAnswer("{1, 2, 3, 4}", ["1", "2", "3"]).message, "Almost! 1 element doesn't belong in this set.");
  assert.match(checkSetAnswer("{1, 5}", ["1", "2"]).message, /1 element is missing and 1 should not be there/);
  assert.equal(checkSetAnswer("{1, 2", ["1", "2"]).correct, false);
  assert.match(checkSetAnswer("{1,,2}", ["1", "2"]).message, /empty item/);
  assert.deepEqual(canonicalSet(["3", " 1", "−2", "1"]), ["-2", "1", "3"]);
});

/* ---------------- Venn regions ---------------- */

test("venn: basic operations on 2 sets", () => {
  assert.deepEqual(evalVenn("A∪B", 2), ["A", "AB", "B"]);
  assert.deepEqual(evalVenn("A∩B", 2), ["AB"]);
  assert.deepEqual(evalVenn("A\\B", 2), ["A"]);
  assert.deepEqual(evalVenn("A′", 2), ["B", "none"]);
  assert.deepEqual(evalVenn("AΔB", 2), ["A", "B"]);
  assert.deepEqual(evalVenn("(A∪B)′", 2), ["none"]);
});

test("venn: 3 sets, precedence and brackets", () => {
  assert.deepEqual(evalVenn("A∩B\\C", 3), ["AB"]);
  assert.deepEqual(evalVenn("(A∪B)\\C", 3), ["A", "B", "AB"]);
  assert.deepEqual(evalVenn("A∩B∩C", 3), ["ABC"]);
  assert.deepEqual(evalVenn("A∪B∩C", 3), evalVenn("A∪(B∩C)", 3), "∩ binds stronger than ∪");
});

test("venn: the textbook identities hold region by region", () => {
  assert.ok(sameRegions(evalVenn("A\\(B∪C)", 3), evalVenn("(A\\B)∩(A\\C)", 3)));
  assert.ok(sameRegions(evalVenn("A∩(B∪C)", 3), evalVenn("(A∩B)∪(A∩C)", 3)));
  assert.ok(sameRegions(evalVenn("A∪(B∩C)", 3), evalVenn("(A∪B)∩(A∪C)", 3)));
  assert.ok(sameRegions(evalVenn("(A∪B)′", 2), evalVenn("A′∩B′", 2)), "De Morgan 1");
  assert.ok(sameRegions(evalVenn("(A∩B)′", 2), evalVenn("A′∪B′", 2)), "De Morgan 2");
  assert.ok(sameRegions(evalVenn("A\\B", 2), evalVenn("A∩B′", 2)));
  assert.ok(!sameRegions(evalVenn("A∪B", 2), evalVenn("A∩B", 2)));
});

test("venn: custom labels, elements per region, bad input", () => {
  assert.deepEqual(evalVenn("F∩B", 2, ["F", "B"]), ["AB"]);
  const elements = { A: ["1"], AB: ["2"], B: ["3"], none: ["4"] };
  assert.deepEqual(elementsOf(evalVenn("A′", 2), elements), ["3", "4"]);
  assert.throws(() => evalVenn("A∪", 2));
  assert.throws(() => evalVenn("A∪D", 2));
  assert.throws(() => evalVenn("(A∪B", 2));
});

/* ---------------- calculator / number answers ---------------- */

test("calculator: order of operations, powers, roots, fractions", () => {
  assert.equal(evaluate("2+3×4"), 14);
  assert.equal(evaluate("(2+3)×4"), 20);
  assert.equal(evaluate("2^3^2"), 512, "right-associative powers");
  assert.equal(evaluate("√16 + 2²"), 8);
  assert.equal(evaluate("−3 + 5"), 2);
  assert.equal(evaluate("2(3+1)"), 8, "implicit ×");
  assert.equal(evaluate("45 + 40 + 35 − 15 − 10 − 12 + 5"), 88);
  assert.equal(toFraction(0.75), "3/4");
  assert.equal(toFraction(1 / 3), "1/3");
  assert.throws(() => evaluate("5/0"));
  assert.throws(() => evaluate("2+"));
});

test("number answers accept equivalent forms", () => {
  assert.equal(checkNumberAnswer("1/2", 0.5).correct, true);
  assert.equal(checkNumberAnswer("0.5", 0.5).correct, true);
  assert.equal(checkNumberAnswer("2^4", 16).correct, true);
  assert.equal(checkNumberAnswer("15", 16).correct, false);
  assert.equal(checkNumberAnswer("", 16).message, "Type a number first");
});
