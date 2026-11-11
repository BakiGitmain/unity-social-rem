/**
 * Text tool helpers, pure (tested): auto-format shortcuts, undo history, and reading TYPED answers on the
 * Answer Paper directly (no AI call).
 */
import { itemBounds, rowHeight, ROW_TOP, type InkItem, type WsLayout } from "./model.ts";

/* ------------------------------------------------------------------ auto-format */

/** Shortcuts shown in the ? help. "U" stays a letter: only backslash words are replaced. */
export const TEXT_SHORTCUTS: [string, string][] = [
  ["\\cup", "∪"],
  ["\\cap", "∩"],
  ["\\in", "∈"],
  ["\\notin", "∉"],
  ["\\subseteq", "⊆"],
  ["\\subset", "⊂"],
  ["\\empty", "∅"],
  ["\\Delta", "Δ"],
  ["\\N", "ℕ"],
  ["\\Z", "ℤ"],
  ["\\Q", "ℚ"],
  ["\\R", "ℝ"],
  ["^2", "²"],
  ["^3", "³"],
  ["->", "→"],
];

const WORDS: Record<string, string> = {
  cup: "∪",
  cap: "∩",
  in: "∈",
  notin: "∉",
  subseteq: "⊆",
  subset: "⊂",
  empty: "∅",
  emptyset: "∅",
  Delta: "Δ",
  setminus: "∖",
  N: "ℕ",
  Z: "ℤ",
  Q: "ℚ",
  R: "ℝ",
};

/**
 * Replace shortcuts. A backslash word is replaced once it is finished (followed by a non-letter), or at the
 * very end when `final` (finishing the text box). So \subset can still grow into \subseteq while typing.
 */
export function autoFormat(text: string, final = false): string {
  let out = text.replace(/\^2/g, "²").replace(/\^3/g, "³").replace(/->/g, "→");
  out = out.replace(/\\([A-Za-z]+)(?=[^A-Za-z])/g, (m, w: string) => WORDS[w] ?? m);
  if (final) out = out.replace(/\\([A-Za-z]+)$/, (m, w: string) => WORDS[w] ?? m);
  return out;
}

/* ------------------------------------------------------------------ undo history */

/** Undo / redo over item lists (text add, edit, move, delete are all just new item lists). */
export function createHistory<T>(initial: T, limit = 100) {
  let present = initial;
  const past: T[] = [];
  const future: T[] = [];
  return {
    get present() {
      return present;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    push(next: T) {
      past.push(present);
      if (past.length > limit) past.shift();
      future.length = 0;
      present = next;
      return present;
    },
    undo() {
      const prev = past.pop();
      if (prev === undefined) return present;
      future.push(present);
      present = prev;
      return present;
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return present;
      past.push(present);
      present = next;
      return present;
    },
    reset(value: T) {
      past.length = 0;
      future.length = 0;
      present = value;
    },
  };
}

/* ------------------------------------------------------------------ typed answers on the worksheet */

export type WorksheetSplit = {
  /** Lines answered ONLY with typed text / placed symbols: read directly by our parser, no AI. */
  typed: Map<number, string>;
  /** Lines with handwriting (they go to the AI). */
  inkRows: number[];
  /** Ink for the AI: only the handwritten lines, moved up so they sit on consecutive lines 0..n-1. */
  inkItems: InkItem[];
};

/** Which line an item belongs to (by its centre). -1 = outside the lines. */
export function itemRow(it: InkItem, rows: number, layout: WsLayout = "side"): number {
  const b = itemBounds(it);
  const cy = (b.minY + b.maxY) / 2;
  const i = Math.floor((cy - ROW_TOP) / rowHeight(layout));
  return i >= 0 && i < rows ? i : -1;
}

/** Split the Answer Paper into typed lines (free, exact) and handwritten lines (AI). Highlighter is ignored. */
export function splitWorksheet(items: InkItem[], rows: number, layout: WsLayout = "side"): WorksheetSplit {
  const byRow = new Map<number, InkItem[]>();
  for (const it of items) {
    if (it.type === "stroke" && it.tool === "highlighter") continue;
    const r = itemRow(it, rows, layout);
    if (r < 0) continue;
    byRow.set(r, [...(byRow.get(r) ?? []), it]);
  }
  const typed = new Map<number, string>();
  const inkRows: number[] = [];
  for (const [r, list] of [...byRow].sort((a, b) => a[0] - b[0])) {
    const handwritten = list.some((it) => it.type === "stroke" || it.type === "shape");
    if (!handwritten) {
      const text = [...list]
        .sort((a, b) => itemBounds(a).minX - itemBounds(b).minX)
        .map((it) => (it.type === "text" || it.type === "symbol" ? it.text : ""))
        .join("")
        .trim();
      if (text) typed.set(r, text);
    } else inkRows.push(r);
  }
  const rh = rowHeight(layout);
  const inkItems: InkItem[] = [];
  inkRows.forEach((r, k) => {
    const dy = (k - r) * rh;
    for (const it of byRow.get(r) ?? []) inkItems.push(dy ? shiftY(it, dy) : it);
  });
  return { typed, inkRows, inkItems };
}

function shiftY(it: InkItem, dy: number): InkItem {
  if (it.type === "stroke") return { ...it, pts: it.pts.map(([x, y, p]) => [x, y + dy, p]) };
  if (it.type === "shape") return { ...it, y1: it.y1 + dy, y2: it.y2 + dy };
  return { ...it, y: it.y + dy };
}
