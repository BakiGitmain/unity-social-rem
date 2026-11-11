/**
 * Checking a student's SET answer, e.g. "{−1, 0, 1}". Pure, tested in sets.test.ts.
 * Order doesn't matter, duplicates and spaces are ignored, and ∅ / { } / "empty" mean the empty set.
 */

/** One element in a canonical form: no spaces, normal minus sign, lower case. */
export function normalizeElement(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[−‒–—]/g, "-") // − ‒ – — → -
    .replace(/\s+/g, "")
    .toLowerCase();
}

const EMPTY = /^(∅|ø|Ø|\{\s*\}|empty|emptyset|phi|ፎ)$/i;

export type ParsedSet = { ok: true; elements: string[] } | { ok: false; error: string };

/** "{1, 2, 2, 3}" → ["1","2","3"]. Braces are optional ("1, 2, 3" also works). */
export function parseSetAnswer(input: string): ParsedSet {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Type your answer first" };
  if (EMPTY.test(raw.replace(/\s+/g, "")) || EMPTY.test(raw)) return { ok: true, elements: [] };
  let body = raw;
  if (body.startsWith("{") || body.endsWith("}")) {
    if (!(body.startsWith("{") && body.endsWith("}"))) return { ok: false, error: "Check your { } brackets" };
    body = body.slice(1, -1);
  }
  if (!body.trim()) return { ok: true, elements: [] };
  const parts = body.split(/[,;،፣]/).map(normalizeElement);
  if (parts.some((p) => p === "")) return { ok: false, error: "There is an empty item between two commas" };
  return { ok: true, elements: [...new Set(parts)] };
}

export type SetCheck = { correct: boolean; missing: number; extra: number; message: string; error?: string };

/** Compare with the expected elements (any order). Friendly feedback for students. */
export function checkSetAnswer(input: string, expected: string[]): SetCheck {
  const parsed = parseSetAnswer(input);
  if (!parsed.ok) return { correct: false, missing: 0, extra: 0, message: parsed.error, error: parsed.error };
  const want = new Set(expected.map(normalizeElement));
  const got = new Set(parsed.elements);
  const missing = [...want].filter((e) => !got.has(e)).length;
  const extra = [...got].filter((e) => !want.has(e)).length;
  const correct = missing === 0 && extra === 0;
  let message = "Correct!";
  if (!correct) {
    if (want.size === 0) message = "This set should be empty (∅).";
    else if (got.size === 0) message = "This set is not empty.";
    else if (missing && extra) message = `Not yet: ${missing} element${missing > 1 ? "s are" : " is"} missing and ${extra} should not be there.`;
    else if (missing) message = `Almost! You're missing ${missing} element${missing > 1 ? "s" : ""}.`;
    else message = `Almost! ${extra} element${extra > 1 ? "s don't" : " doesn't"} belong in this set.`;
  }
  return { correct, missing, extra, message };
}

/** Canonical form stored with quiz answers (sorted, unique, normalized), so the database can compare too. */
export function canonicalSet(elements: string[]): string[] {
  return [...new Set(elements.map(normalizeElement))].sort();
}
