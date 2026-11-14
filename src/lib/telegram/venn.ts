/**
 * Venn diagrams for Rem in Telegram. Telegram can't draw, and text-art circles look broken, so Rem writes ONE line
 *   VENN: {"sets":["A","B"],"shade":"A ∩ B","elements":{"A":[1,2],"AB":[3],"B":[4],"none":[5]},"names":{"A":"even"}}
 * which is removed from the text and drawn on the server as a PNG with numbered regions (venn-image.ts).
 * Pure (no network), tested in venn.test.ts. Region names follow src/lib/math/venn.ts: "A", "AB", "ABC"…, "none".
 */
import { REGIONS, evalVenn, type VennSize } from "../math/venn.ts";
import { esc } from "./format.ts";
import type { Lang } from "./i18n.ts";

export const VENN_MARK = "VENN:";

export type VennSpec = {
  size: VennSize;
  /** One letter per circle, as written by Rem (e.g. ["F", "B"]). */
  labels: string[];
  /** Full names for the caption ("F = football"), or null. */
  names: (string | null)[];
  /** The shaded expression as written (for the caption), or null. */
  shade: string | null;
  /** Shaded regions, canonical ("A", "AB", …, "none"). */
  shaded: string[];
  /** Elements per canonical region. */
  elements: Record<string, string[]>;
};

const CANON = ["A", "B", "C"];
const MAX_ELEMENTS = 12;

/** Region number shown in the picture: its position in REGIONS (2 sets: A=1, AB=2, B=3, none=4). */
export const regionNumber = (size: VennSize, region: string) => REGIONS[size].indexOf(region) + 1;
const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

/* ------------------------------------------------------------------ reading Rem's VENN line */

/** The `{…}` starting at `from` (strings and nested braces respected), or null. */
function balancedJson(s: string, from: number): { json: string; end: number } | null {
  let depth = 0;
  let inStr = false;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return { json: s.slice(from, i + 1), end: i + 1 };
  }
  return null;
}

/** Removes every VENN line from Rem's text (never shown raw) and returns the first valid diagram. */
export function extractVenn(text: string): { text: string; spec: VennSpec | null } {
  let out = text;
  let spec: VennSpec | null = null;
  for (let guard = 0; guard < 3; guard++) {
    const i = out.indexOf(VENN_MARK);
    if (i < 0) break;
    const lineStart = out.lastIndexOf("\n", i) + 1;
    const brace = out.indexOf("{", i);
    const lineEnd = out.indexOf("\n", i) < 0 ? out.length : out.indexOf("\n", i);
    const found = brace >= 0 ? balancedJson(out, brace) : null;
    let end = lineEnd;
    if (found) {
      end = Math.max(found.end, out.indexOf("\n", found.end) < 0 ? out.length : out.indexOf("\n", found.end));
      if (!spec) {
        try {
          spec = parseVennSpec(JSON.parse(found.json));
        } catch {
          /* not JSON: drop the line, explain in words */
        }
      }
    }
    if (out[end] === "\n") end++;
    out = out.slice(0, lineStart) + out.slice(end);
  }
  return { text: out.replace(/\n{3,}/g, "\n\n").trim(), spec };
}

const clipStr = (s: string, n: number) => ([...s].length > n ? [...s].slice(0, n - 1).join("") + "…" : s);

/** Validates Rem's JSON. Anything odd is dropped, never thrown. */
export function parseVennSpec(raw: unknown): VennSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sets = typeof r.sets === "number" ? CANON.slice(0, r.sets) : Array.isArray(r.sets) ? r.sets.map((s) => String(s ?? "").trim()) : [];
  if (sets.length !== 2 && sets.length !== 3) return null;
  const size = sets.length as VennSize;

  // Circles are single letters (A, B, F…). A word ("Football") becomes A/B/C with the word as its name.
  const labels: string[] = [];
  const names: (string | null)[] = [];
  sets.forEach((s, i) => {
    const letter = s.toUpperCase();
    const ok = /^[A-Z]$/.test(letter) && letter !== "U" && !labels.includes(letter);
    labels.push(ok ? letter : CANON.find((c) => !labels.includes(c) && !sets.slice(i + 1).some((x) => x.toUpperCase() === c))!);
    names.push(ok ? null : clipStr(s, 40) || null);
  });
  const nameMap = r.names;
  if (nameMap && typeof nameMap === "object") {
    for (const [k, v] of Object.entries(nameMap as Record<string, unknown>)) {
      const i = labels.indexOf(k.trim().toUpperCase());
      if (i >= 0 && typeof v === "string" && v.trim()) names[i] = clipStr(v.trim(), 40);
    }
  }

  let shade: string | null = null;
  let shaded: string[] = [];
  if (typeof r.shade === "string" && r.shade.trim()) {
    try {
      shaded = evalVenn(r.shade, size, labels);
      shade = clipStr(r.shade.trim(), 60);
    } catch {
      /* unreadable expression: no shading */
    }
  }

  const elements: Record<string, string[]> = {};
  if (r.elements && typeof r.elements === "object") {
    for (const [k, v] of Object.entries(r.elements as Record<string, unknown>)) {
      const region = canonicalRegion(k, labels, size);
      if (!region || !Array.isArray(v)) continue;
      const items = v.map((x) => clipStr(String(x ?? "").trim(), 12)).filter(Boolean);
      elements[region] = [...new Set([...(elements[region] ?? []), ...items])].slice(0, MAX_ELEMENTS);
    }
  }
  return { size, labels, names, shade, shaded, elements };
}

/** "FB", "F∩B", "B,F" → "AB" (the circles it is inside); "none" / "outside" / "U" → "none". */
export function canonicalRegion(key: string, labels: string[], size: VennSize): string | null {
  const k = key.trim();
  if (/^(none|outside|neither|u|ξ|rest)$/i.test(k)) return "none";
  const idx = new Set<number>();
  for (const ch of k.toUpperCase().replace(/[^A-Z]/g, "")) {
    const i = labels.indexOf(ch);
    if (i < 0) return null;
    idx.add(i);
  }
  if (!idx.size) return null;
  const name = [...idx].sort().map((i) => CANON[i]).join("");
  return REGIONS[size].includes(name) ? name : null;
}

/* ------------------------------------------------------------------ geometry (used by the renderer) */

export type VennLayout = {
  width: number;
  height: number;
  r: number;
  centers: [number, number][];
  /** Where each circle's letter goes. */
  labelAt: [number, number][];
  /** Centre of each region (for its number + elements) and the width its elements may use. */
  regions: Record<string, { at: [number, number]; w: number }>;
};

export const VENN_LAYOUT: Record<VennSize, VennLayout> = {
  2: {
    width: 640,
    height: 440,
    r: 135,
    centers: [
      [245, 225],
      [395, 225],
    ],
    labelAt: [
      [128, 96],
      [512, 96],
    ],
    regions: {
      A: { at: [172, 225], w: 120 },
      AB: { at: [320, 225], w: 96 },
      B: { at: [468, 225], w: 120 },
      none: { at: [52, 392], w: 230 },
    },
  },
  3: {
    width: 640,
    height: 520,
    r: 125,
    centers: [
      [250, 205],
      [390, 205],
      [320, 330],
    ],
    labelAt: [
      [118, 78],
      [522, 78],
      [478, 470],
    ],
    regions: {
      A: { at: [188, 172], w: 100 },
      B: { at: [452, 172], w: 100 },
      C: { at: [320, 402], w: 120 },
      AB: { at: [320, 158], w: 66 },
      AC: { at: [250, 292], w: 66 },
      BC: { at: [390, 292], w: 66 },
      ABC: { at: [320, 246], w: 56 },
      none: { at: [52, 472], w: 230 },
    },
  },
};

/** Only plain ASCII is drawn in the picture (its font is Latin-only); anything else goes into the caption. */
export const drawable = (s: string) => /^[\x20-\x7E]+$/.test(s);
export const allDrawable = (spec: VennSpec) => Object.values(spec.elements).every((items) => items.every(drawable));

/* ------------------------------------------------------------------ caption */

/** What each numbered region means, with the real letters ("A only", "A ∩ B", "outside both"). */
export function regionMeaning(region: string, spec: Pick<VennSpec, "size" | "labels">, lang: Lang): string {
  const L = (c: string) => spec.labels[CANON.indexOf(c)]!;
  if (region === "none") return spec.size === 2 ? (lang === "am" ? "ከሁለቱም ውጪ" : "outside both") : lang === "am" ? "ከሁሉም ውጪ" : "outside all";
  const sets = [...region].map(L).join(" ∩ ");
  const only = lang === "am" ? " ብቻ" : " only";
  return region.length === spec.size ? sets : sets + only;
}

/** A name that only repeats the letter ("A", "Set A", "set a") says nothing. */
const trivialName = (name: string, label: string) => name.replace(/^set\s+/i, "").trim().toUpperCase() === label;

/** Every element of circle i (all the regions inside it), in order; numbers sorted. */
export function setElements(spec: VennSpec, i: number): string[] {
  const letter = CANON[i]!;
  const items = REGIONS[spec.size].filter((r) => r !== "none" && r.includes(letter)).flatMap((r) => spec.elements[r] ?? []);
  const unique = [...new Set(items)];
  return unique.every((x) => /^-?\d+(\.\d+)?$/.test(x)) ? unique.sort((a, b) => Number(a) - Number(b)) : unique;
}

/** "A = odd numbers" when Rem named the set, else "A = {1, 2, 3}" when its elements are known, else nothing. */
export function setLegend(spec: VennSpec, i: number): string {
  const label = spec.labels[i]!;
  const name = spec.names[i];
  if (name && !trivialName(name, label)) return `${label} = ${esc(name)}`;
  const items = setElements(spec, i);
  if (!items.length) return "";
  return `${label} = {${esc(clipStr(items.join(", "), 60))}}`;
}

/** Photo caption (Telegram HTML, < 1024 chars): names, what is shaded, the numbered regions. */
export function vennCaption(spec: VennSpec, lang: Lang): string {
  const lines = [`🔵 <b>${lang === "am" ? "የቬን ንድፍ" : "Venn diagram"}</b>`];
  const named = spec.labels.map((_, i) => setLegend(spec, i)).filter(Boolean);
  if (named.length) lines.push(named.join(" · "));
  if (spec.shade && spec.shaded.length) lines.push(`🟨 ${lang === "am" ? "የተቀባው" : "Shaded"}: <b>${esc(spec.shade)}</b>`);
  const listElements = !allDrawable(spec);
  lines.push(
    REGIONS[spec.size]
      .map((r) => {
        const els = listElements && spec.elements[r]?.length ? `: {${esc(spec.elements[r]!.join(", "))}}` : "";
        return `${CIRCLED[regionNumber(spec.size, r) - 1]} ${esc(regionMeaning(r, spec, lang))}${els}`;
      })
      .join(listElements ? "\n" : " · "),
  );
  const html = lines.join("\n");
  return html.length <= 1024 ? html : lines.slice(0, -1).join("\n");
}

/** One short line for Rem's chat history, so follow-up questions know what was drawn. */
export function vennHistoryNote(spec: VennSpec): string {
  return `[Sent a Venn diagram image: sets ${spec.labels.join(", ")}${spec.shade ? `; shaded ${spec.shade}` : ""}]`;
}

/* ------------------------------------------------------------------ no text-art */

const BOX = /[─-▟○◯●]/;
const ART_CHARS = /[()[\]{}/\\|_\-~^<>]/g;

/** A fenced block is a drawing when it is mostly lines, brackets and spaces (or uses box-drawing characters). */
function looksLikeArt(block: string): boolean {
  if (BOX.test(block)) return true;
  const lines = block.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return false;
  const ink = block.replace(/\s/g, "");
  const art = (block.match(ART_CHARS) ?? []).length;
  const wideGaps = lines.filter((l) => /\S\s{3,}\S/.test(l)).length;
  return art / Math.max(1, ink.length) >= 0.35 || wideGaps >= Math.ceil(lines.length / 2);
}

/** Drops text-art drawings (Rem must never draw with characters in Telegram). */
export function stripTextArt(md: string): string {
  return md
    .replace(/```[^\n]*\n([\s\S]*?)```\n?/g, (whole, inner: string) => (looksLikeArt(inner) ? "" : whole))
    .split("\n")
    .filter((l) => !BOX.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
