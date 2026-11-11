/**
 * What the AI returns when it reads a handwritten answer, and how we use it. Pure (tested in ink.test.ts).
 * The AI only READS; grading is always done by our own checkers (sets.ts / calc.ts).
 */
import { checkSetAnswer, type SetCheck } from "../math/sets.ts";
import { checkNumberAnswer } from "../math/calc.ts";

export type ExpectKind = "set" | "number";
export type Recognition = {
  latex: string;
  type: "set" | "number" | "expression" | "unreadable";
  elements: string[] | null;
  value: number | null;
  confidence: number;
};

/** Strict JSON schema sent to the model (structured output). */
export const RECOGNITION_SCHEMA = {
  type: "object",
  properties: {
    latex: { type: "string", description: "Exactly what is written, as LaTeX (e.g. \\{1, 2, 3\\} or \\emptyset or -4)." },
    type: { type: "string", enum: ["set", "number", "expression", "unreadable"] },
    elements: {
      type: ["array", "null"],
      items: { type: "string" },
      description: "For a set: each element as written, in order (e.g. [\"-1\", \"0\", \"1\"]). [] for the empty set. null otherwise.",
    },
    value: { type: ["number", "null"], description: "For a number: its value. null otherwise." },
    confidence: { type: "number", minimum: 0, maximum: 1, description: "How sure you are that you read it correctly." },
  },
  required: ["latex", "type", "elements", "value", "confidence"],
  additionalProperties: false,
} as const;

/** Worksheet (several labelled lines on one paper): one result per printed label, in ONE call. */
export const RECOGNITION_PARTS_SCHEMA = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string", description: "The printed label of the line, copied exactly." }, ...RECOGNITION_SCHEMA.properties },
        required: ["label", ...RECOGNITION_SCHEMA.required],
        additionalProperties: false,
      },
    },
  },
  required: ["parts"],
  additionalProperties: false,
} as const;

const TYPES = new Set(["set", "number", "expression", "unreadable"]);

/** Validate untrusted model output. Anything malformed → null (treated as unreadable). */
export function parseRecognition(raw: unknown): Recognition | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.some((k) => !["latex", "type", "elements", "value", "confidence"].includes(k))) return null;
  if (typeof r.latex !== "string" || r.latex.length > 500) return null;
  if (typeof r.type !== "string" || !TYPES.has(r.type)) return null;
  if (r.elements !== null && !(Array.isArray(r.elements) && r.elements.length <= 60 && r.elements.every((e) => typeof e === "string" && e.length <= 40))) return null;
  if (r.value !== null && !(typeof r.value === "number" && Number.isFinite(r.value))) return null;
  if (typeof r.confidence !== "number" || !Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1) return null;
  return { latex: r.latex, type: r.type as Recognition["type"], elements: r.elements as string[] | null, value: r.value as number | null, confidence: r.confidence };
}

export const UNREADABLE: Recognition = { latex: "", type: "unreadable", elements: null, value: null, confidence: 0 };

/**
 * Validate a worksheet reading: one Recognition per expected label, in label order.
 * Lines the model skipped or garbled become UNREADABLE (never a crash, never a wrong line).
 */
export function parseParts(raw: unknown, labels: string[]): Recognition[] | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { parts?: unknown }).parts)) return null;
  const parts = (raw as { parts: unknown[] }).parts.slice(0, 20);
  const byLabel = new Map<string, Recognition>();
  const norm = (l: string) => l.replace(/[\s$\\]/g, "").toLowerCase();
  parts.forEach((p, i) => {
    if (!p || typeof p !== "object") return;
    const { label, ...rest } = p as Record<string, unknown>;
    const r = parseRecognition(rest);
    if (!r) return;
    const key = typeof label === "string" ? norm(label) : "";
    if (key && !byLabel.has(key)) byLabel.set(key, r);
    if (!byLabel.has(`#${i}`)) byLabel.set(`#${i}`, r);
  });
  return labels.map((l, i) => byLabel.get(norm(l)) ?? (parts.length === labels.length ? byLabel.get(`#${i}`) : undefined) ?? UNREADABLE);
}

/** The recognised answer as the text our checkers understand ("{1, 2}", "∅", "-4"). "" = nothing usable. */
export function answerText(r: Recognition, kind: ExpectKind): string {
  if (r.type === "unreadable") return "";
  if (kind === "set") {
    if (r.elements) return r.elements.length ? `{${r.elements.join(", ")}}` : "∅";
    return r.latex
      .replace(/\\emptyset|\\varnothing/g, "∅")
      .replace(/\\[{}]/g, (m) => m.slice(1))
      .replace(/\\left|\\right|\\,|\\ /g, "")
      .trim();
  }
  if (r.value !== null) return String(r.value);
  return r.latex.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)").replace(/\\(left|right)/g, "").trim();
}

/** Ask "Did I read that right?" before grading? */
export function needsConfirm(r: Recognition): boolean {
  return r.type === "unreadable" || r.confidence < 0.8;
}

export type Grade = { correct: boolean; message: string; detail?: SetCheck };

/** Grade a (recognised or typed) answer with OUR checker. */
export function gradeAnswer(text: string, kind: ExpectKind, expected: number | string[]): Grade {
  if (kind === "set") {
    const c = checkSetAnswer(text, expected as string[]);
    return { correct: c.correct, message: c.message, detail: c };
  }
  return checkNumberAnswer(text, expected as number);
}

/* ------------------------------------------------------------------ cache */

export type RecognitionCache = {
  get(key: string): Promise<Recognition | undefined> | Recognition | undefined;
  set(key: string, value: Recognition): Promise<void> | void;
};

/**
 * Wraps the network call: the same ink (same hash) never costs a second AI call. Concurrent calls for the
 * same key share one request. Unreadable results are not cached (the student will rewrite anyway).
 */
export type Cache<R> = { get(key: string): Promise<R | undefined> | R | undefined; set(key: string, value: R): Promise<void> | void };

const readable = (r: unknown) =>
  Array.isArray(r) ? r.some((x) => (x as Recognition).type !== "unreadable") : (r as Recognition).type !== "unreadable";

export function createRecognizer<P, R = Recognition>(call: (payload: P) => Promise<R>, cache: Cache<R>) {
  const inflight = new Map<string, Promise<R>>();
  return async function recognize(key: string, payload: () => P | Promise<P>): Promise<{ result: R; cached: boolean }> {
    const hit = await cache.get(key);
    if (hit) return { result: hit, cached: true };
    let p = inflight.get(key);
    if (!p) {
      p = (async () => {
        const r = await call(await payload());
        if (readable(r)) await cache.set(key, r);
        return r;
      })();
      inflight.set(key, p);
      p.finally(() => inflight.delete(key)).catch(() => {});
    }
    return { result: await p, cached: false };
  };
}

/* ------------------------------------------------------------------ availability / fallback */

export type InkStatus = { loggedIn: boolean; available?: boolean; reason?: string | null; checks?: number; limit?: number };

/** Handwriting (AI reads it) or typing? With a friendly note when we fall back to typing. */
export function inkMode(s: InkStatus): { mode: "ink" | "type"; note: string | null } {
  if (!s.loggedIn) return { mode: "type", note: "Log in to have your handwriting checked. You can type your answer for now." };
  if (s.available === false) {
    if (s.reason === "budget") return { mode: "type", note: "Handwriting checks are resting for this month. Please type your answer." };
    return { mode: "type", note: "Handwriting checks are off right now. Please type your answer." };
  }
  if (s.limit !== undefined && s.checks !== undefined && s.checks >= s.limit)
    return { mode: "type", note: "You've used today's handwriting checks. Type your answer instead; they reset tomorrow." };
  return { mode: "ink", note: null };
}
