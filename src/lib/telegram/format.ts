/**
 * Telegram HTML formatting for @UnitySocialRemBot: escaping, "futuristic" cards, ▰▰▰▱▱ bars, LaTeX → plain
 * Unicode math (Telegram can't render KaTeX) and Rem's Markdown → Telegram HTML.
 * Pure functions, no dependencies (tested in format.test.ts).
 */

/** Telegram's limits. */
export const TG_LIMITS = {
  message: 4096,
  pollQuestion: 300,
  pollOption: 100,
  pollExplanation: 200,
  callbackData: 64,
} as const;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escaped text for an HTML attribute (href). */
function escAttr(s: string): string {
  return esc(s).replace(/"/g, "&quot;");
}

/** Cuts plain text to `max` characters (adds "…"). */
export function clip(s: string, max: number): string {
  const chars = [...s];
  return chars.length <= max ? s : chars.slice(0, Math.max(0, max - 1)).join("").trimEnd() + "…";
}

/** ▰▰▰▱▱ progress bar. `value` 0…1 (clamped). */
export function bar(value: number, cells = 10): string {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const full = Math.round(v * cells);
  return "▰".repeat(full) + "▱".repeat(cells - full);
}

/** Bar + percentage, e.g. "▰▰▰▰▱▱▱▱▱▱ 40%". */
export function barPct(done: number, total: number, cells = 10): string {
  const v = total > 0 ? done / total : 0;
  return `${bar(v, cells)} ${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
}

export const DIVIDER = "━━━━━━━━━━━━━━━━";

/**
 * A card: bold header with an icon, a thin divider, then short sections separated by blank lines.
 * `title` and `subtitle` are plain text (escaped here); sections are ready HTML.
 */
export function card(opts: { icon: string; title: string; subtitle?: string; sections: (string | null | undefined | false)[]; footer?: string }): string {
  const head = `${opts.icon} <b>${esc(opts.title.toUpperCase())}</b>${opts.subtitle ? `\n<i>${esc(opts.subtitle)}</i>` : ""}`;
  const body = opts.sections.filter((s): s is string => typeof s === "string" && s.trim() !== "");
  const parts = [head, DIVIDER, ...body];
  if (opts.footer) parts.push(`<i>${opts.footer}</i>`);
  return clipHtml(parts.join("\n\n"), TG_LIMITS.message);
}

/** Keeps an HTML message under Telegram's limit by cutting whole lines (never inside a tag). */
export function clipHtml(html: string, max: number): string {
  if (html.length <= max) return html;
  const lines = html.split("\n");
  let out = "";
  for (const line of lines) {
    if (out.length + line.length + 2 > max - 2) break;
    out += (out ? "\n" : "") + line;
  }
  return closeTags(out) + "\n…";
}

/** Closes any tags left open after cutting (b, i, u, s, code, pre, blockquote, a). */
function closeTags(html: string): string {
  const stack: string[] = [];
  for (const m of html.matchAll(/<(\/?)(b|i|u|s|code|pre|blockquote|a)(?:\s[^>]*)?>/g)) {
    if (m[1]) {
      const i = stack.lastIndexOf(m[2]!);
      if (i >= 0) stack.splice(i, 1);
    } else stack.push(m[2]!);
  }
  return html + stack.reverse().map((t) => `</${t}>`).join("");
}

/** "2 h 15 min" / "15 min" / "2 ሰ 15 ደ". Minutes are rounded up (a countdown never shows 0 while time is left). */
export function duration(minutes: number, lang: "en" | "am"): string {
  const total = Math.max(0, Math.ceil(minutes - 1e-9));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const u = lang === "am" ? { d: "ቀን", h: "ሰዓት", m: "ደቂቃ" } : { d: "d", h: "h", m: "min" };
  const out: string[] = [];
  if (d) out.push(`${d} ${u.d}`);
  if (h) out.push(`${h} ${u.h}`);
  if ((m || !out.length) && !d) out.push(`${m} ${u.m}`);
  return out.join(" ");
}

/* ------------------------------------------------------------------ LaTeX → plain Unicode */

const SYMBOLS: Record<string, string> = {
  cup: "∪", cap: "∩", setminus: "∖", backslash: "∖", in: "∈", notin: "∉", ni: "∋", subseteq: "⊆", subset: "⊂",
  supseteq: "⊇", supset: "⊃", nsubseteq: "⊈", not: "¬", emptyset: "∅", varnothing: "∅", le: "≤", leq: "≤",
  ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈", equiv: "≡", times: "×", div: "÷", cdot: "·", pm: "±", mp: "∓",
  Delta: "Δ", delta: "δ", triangle: "△", bigtriangleup: "△", ominus: "⊖", oplus: "⊕", infty: "∞", pi: "π", theta: "θ",
  alpha: "α", beta: "β", gamma: "γ", lambda: "λ", mu: "μ", sigma: "σ", Sigma: "Σ", omega: "ω", phi: "φ",
  to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐", iff: "⇔", Leftrightarrow: "⇔",
  leftrightarrow: "↔", implies: "⇒", forall: "∀", exists: "∃", land: "∧", wedge: "∧", lor: "∨", vee: "∨", neg: "¬",
  lnot: "¬", ldots: "…", dots: "…", cdots: "⋯", angle: "∠", circ: "°", degree: "°", mid: "|", vert: "|",
  colon: ":", prime: "′", perp: "⊥", parallel: "∥", sim: "∼", cong: "≅", propto: "∝", therefore: "∴", because: "∵",
  quad: " ", qquad: "  ", lbrace: "{", rbrace: "}", langle: "⟨", rangle: "⟩", lvert: "|", rvert: "|", complement: "∁",
};
const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", P: "ℙ" };
const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", x: "ˣ", c: "ᶜ", "′": "′", "'": "′",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", n: "ₙ", i: "ᵢ", x: "ₓ",
};
const script = (s: string, map: Record<string, string>, mark: string) =>
  [...s].every((c) => map[c]) ? [...s].map((c) => map[c]).join("") : `${mark}(${s})`;

/** Reads one {group} (or a single character) starting at `i`. Returns [content, next index]. */
function group(s: string, i: number): [string, number] {
  while (s[i] === " ") i++;
  if (s[i] === "{") {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{" && s[j - 1] !== "\\") depth++;
      else if (s[j] === "}" && s[j - 1] !== "\\") {
        depth--;
        if (depth === 0) return [s.slice(i + 1, j), j + 1];
      }
    }
    return [s.slice(i + 1), s.length];
  }
  if (s[i] === "\\") {
    const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
    if (m) return [m[0], i + m[0].length];
  }
  return [s[i] ?? "", i + 1];
}

/** One LaTeX expression (the inside of $…$) → readable Unicode text: \{1, 2\} \cup B → {1, 2} ∪ B. */
export function texToPlain(tex: string): string {
  let out = "";
  let i = 0;
  const s = tex;
  while (i < s.length) {
    const c = s[i]!;
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      if (!m) {
        i++;
        continue;
      }
      const name = m[1]!;
      i += m[0].length;
      if (name === "{" || name === "}") out += name;
      else if (name === "," || name === ";" || name === ":" || name === " " || name === "!") out += name === "!" ? "" : " ";
      else if (name === "\\") out += " ";
      else if (name === "%" || name === "$" || name === "&" || name === "#" || name === "_") out += name;
      else if (name === "left" || name === "right" || name === "big" || name === "Big" || name === "displaystyle") {
        /* sizing: drop */
      } else if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const [a, j] = group(s, i);
        const [b, k] = group(s, j);
        i = k;
        const A = texToPlain(a);
        const B = texToPlain(b);
        out += `${/^[\w′]+$/u.test(A) ? A : `(${A})`}/${/^[\w′]+$/u.test(B) ? B : `(${B})`}`;
      } else if (name === "sqrt") {
        const [a, j] = group(s, i);
        i = j;
        const A = texToPlain(a);
        out += [...A].length === 1 ? `√${A}` : `√(${A})`;
      } else if (name === "mathbb") {
        const [a, j] = group(s, i);
        i = j;
        out += BLACKBOARD[a] ?? a;
      } else if (["text", "mathrm", "textbf", "mathbf", "textit", "mathit", "operatorname", "mbox", "overline", "bar", "underline", "hat", "vec", "boxed"].includes(name)) {
        const [a, j] = group(s, i);
        i = j;
        out += /^(text|mbox)/.test(name) ? a : texToPlain(a);
      } else if (SYMBOLS[name] !== undefined) {
        out += SYMBOLS[name];
        // "\not\in" → ∉
        if (name === "not" && /^\s*\\in\b/.test(s.slice(i))) {
          out = out.slice(0, -1) + "∉";
          i = s.indexOf("in", i) + 2;
        }
      } else out += name;
    } else if (c === "^" || c === "_") {
      const [a, j] = group(s, i + 1);
      i = j;
      const A = texToPlain(a).replace(/\s+/g, "");
      if (c === "^" && (A === "∘" || A === "°" || a.trim() === "\\circ")) out += "°";
      else out += script(A, c === "^" ? SUP : SUB, c);
    } else if (c === "{" || c === "}") {
      i++; // grouping braces
    } else if (c === "~") {
      out += " ";
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

/** Plain text with inline $…$ / $$…$$ math turned into Unicode, for polls and buttons (no HTML). */
export function plainMath(text: string): string {
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t: string) => texToPlain(t))
    .replace(/\$([^$\n]+?)\$/g, (_, t: string) => texToPlain(t))
    .replace(/\*\*(.+?)\*\*/g, "$1");
}

/** Escaped HTML with **bold** and $math$ (for lesson titles, questions, notes text). */
export function inlineHtml(text: string): string {
  const slots: string[] = [];
  const hold = (html: string) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = text
    .replace(/`([^`\n]+)`/g, (_, c: string) => hold(`<code>${esc(c)}</code>`))
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t: string) => hold(esc(texToPlain(t))))
    .replace(/\$([^$\n]+?)\$/g, (_, t: string) => hold(esc(texToPlain(t))))
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label: string, url: string) => hold(`<a href="${escAttr(url)}">${esc(label)}</a>`));
  s = esc(s)
    .replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>")
    .replace(/__([^_\n]+?)__/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*(?!\s)([^*\n]*?[^*\s])\*(?=[\s).,!?:;]|$)/g, "$1<i>$2</i>")
    .replace(/(^|[\s(])_(?!\s)([^_\n]*?[^_\s])_(?=[\s).,!?:;]|$)/g, "$1<i>$2</i>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, n: string) => slots[Number(n)] ?? "");
}

/* ------------------------------------------------------------------ Rem's Markdown → Telegram HTML */

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

/** Splits off Rem's last line "FOLLOWUPS: a | b | c". */
/** Mostly Ethiopic letters (an Amharic answer), whatever the student's bot language is. */
export function isAmharicText(s: string): boolean {
  const am = (s.match(/[ሀ-፿]/g) ?? []).length;
  const latin = (s.match(/[A-Za-z]/g) ?? []).length;
  return am > 0 && am >= latin;
}

export const TIP_AM = "ጠቃሚ ምክር፡";

/** In Amharic answers the tip line says "ጠቃሚ ምክር፡", not "Tip:" (keeps 💡 and any bold). */
export function localizeTip(md: string): string {
  if (!isAmharicText(md)) return md;
  return md
    .split("\n")
    .map((line) => {
      const m = /^(\s*[*_💡\s]*)Tip([*_]*)\s*[:：፡፦]/iu.exec(line);
      if (!m) return line;
      const prefix = m[1]!.includes("💡") ? m[1]! : `💡 ${m[1]!.trimStart()}`;
      return `${prefix}${TIP_AM}${m[2]}${line.slice(m[0].length)}`;
    })
    .join("\n");
}

export function splitFollowups(text: string, mark = "FOLLOWUPS:"): { body: string; followups: string[] } {
  const i = text.lastIndexOf(mark);
  if (i < 0) return { body: text.trim(), followups: [] };
  const followups = text
    .slice(i + mark.length)
    .split("|")
    .map((q) => q.trim().replace(/^[-*•\d.)\s]+/, ""))
    .filter((q) => q.length > 1)
    .slice(0, 3);
  return { body: text.slice(0, i).trim(), followups };
}

/**
 * Markdown (bold, italics, headings, lists, numbered steps, tables, code, quotes, $math$) → Telegram HTML.
 * Tables become one line per row ("▸ <b>first cell</b> — other · cells"), because Telegram has no tables.
 */
export function mdToTelegramHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // ``` code ```
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) body.push(lines[i++]!);
      i++;
      out.push(`<pre>${esc(body.join("\n"))}</pre>`);
      continue;
    }
    // $$ … $$ on its own lines
    if (/^\s*\$\$/.test(line)) {
      const body: string[] = [line.replace(/^\s*\$\$/, "")];
      if (!/\$\$\s*$/.test(line.replace(/^\s*\$\$/, ""))) {
        i++;
        while (i < lines.length && !/\$\$\s*$/.test(lines[i]!)) body.push(lines[i++]!);
        if (i < lines.length) body.push(lines[i]!);
      }
      i++;
      const tex = body.join(" ").replace(/\$\$/g, "");
      out.push(`<code>${esc(texToPlain(tex))}</code>`);
      continue;
    }
    // | table |
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]!)) {
      const head = cells(line);
      i += 2;
      const rows: string[] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i]!)) {
        const r = cells(lines[i++]!);
        const rest = r.slice(1).filter(Boolean).map(inlineHtml).join(" · ");
        rows.push(`▸ <b>${inlineHtml(r[0] ?? "")}</b>${rest ? ` — ${rest}` : ""}`);
      }
      out.push(`<i>${head.map(inlineHtml).join(" · ")}</i>\n${rows.join("\n")}`);
      continue;
    }
    // heading
    const h = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      out.push(`<b>${inlineHtml(h[1]!.replace(/\*\*/g, ""))}</b>`);
      i++;
      continue;
    }
    // quote
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) body.push(inlineHtml(lines[i++]!.replace(/^\s*>\s?/, "")));
      out.push(`<blockquote>${body.join("\n")}</blockquote>`);
      continue;
    }
    // lists
    const ul = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      out.push(`${ul[1]!.length >= 2 ? "   ◦" : "•"} ${inlineHtml(ul[2]!)}`);
      i++;
      continue;
    }
    const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ol) {
      out.push(`<b>${ol[1]}.</b> ${inlineHtml(ol[2]!)}`);
      i++;
      continue;
    }
    // horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push("┈┈┈┈┈┈┈┈");
      i++;
      continue;
    }
    out.push(line.trim() ? inlineHtml(line) : "");
    i++;
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
