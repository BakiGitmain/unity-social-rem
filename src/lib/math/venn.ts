/**
 * Venn diagram regions as DATA. A region is named by the sets it is inside: "A", "AB", "ABC"… and "none"
 * (inside U, outside every circle). Set expressions like "A∩B∖C" or "(A∪B)′" are evaluated to the list of
 * regions they cover. Pure, tested in venn.test.ts.
 */

export type VennSize = 2 | 3;

export const REGIONS: Record<VennSize, string[]> = {
  2: ["A", "AB", "B", "none"],
  3: ["A", "B", "C", "AB", "AC", "BC", "ABC", "none"],
};

const NAMES = ["A", "B", "C"];

/** Which regions are inside set number i (0 = A, 1 = B, 2 = C). */
function regionsOf(i: number, size: VennSize): Set<string> {
  return new Set(REGIONS[size].filter((r) => r !== "none" && r.includes(NAMES[i]!)));
}

type Tok = { t: "set"; v: number } | { t: "U" } | { t: "empty" } | { t: "op"; v: "∪" | "∩" | "∖" | "Δ" } | { t: "′" } | { t: "(" } | { t: ")" };

/** Tokens; set letters are mapped through `labels` (e.g. ["F", "B"] → F = first circle). */
function tokenize(expr: string, labels: string[]): Tok[] {
  const out: Tok[] = [];
  const s = expr.replace(/\s+/g, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "(" || c === "[") out.push({ t: "(" });
    else if (c === ")" || c === "]") out.push({ t: ")" });
    else if (c === "∪" || c === "+" || c === "|") out.push({ t: "op", v: "∪" });
    else if (c === "∩" || c === "&") out.push({ t: "op", v: "∩" });
    else if (c === "\\" || c === "∖" || c === "-" || c === "−") out.push({ t: "op", v: "∖" });
    else if (c === "Δ" || c === "∆" || c === "⊕") out.push({ t: "op", v: "Δ" });
    else if (c === "′" || c === "'" || c === "ᶜ") out.push({ t: "′" });
    else if (c === "∅" || c === "Ø") out.push({ t: "empty" });
    else {
      const idx = labels.findIndex((l) => l.toUpperCase() === c.toUpperCase());
      if (idx >= 0) out.push({ t: "set", v: idx });
      else if (c === "U" || c === "u" || c === "ξ") out.push({ t: "U" });
      else throw new Error(`Unknown symbol "${c}"`);
    }
  }
  return out;
}

/**
 * Evaluate a set expression to regions. Precedence: ′ (complement) > ∩ > ∪ ∖ Δ (left to right).
 * Use brackets when in doubt, as in the textbook.
 */
export function evalVenn(expr: string, size: VennSize, labels: string[] = NAMES.slice(0, size)): string[] {
  const toks = tokenize(expr, labels);
  let pos = 0;
  const all = new Set(REGIONS[size]);

  const primary = (): Set<string> => {
    const tk = toks[pos++];
    if (!tk) throw new Error("Unexpected end");
    let v: Set<string>;
    if (tk.t === "(") {
      v = union();
      if (toks[pos++]?.t !== ")") throw new Error("Missing )");
    } else if (tk.t === "set") {
      if (tk.v >= size) throw new Error("Unknown set");
      v = regionsOf(tk.v, size);
    } else if (tk.t === "U") v = new Set(all);
    else if (tk.t === "empty") v = new Set();
    else throw new Error("Unexpected symbol");
    while (toks[pos]?.t === "′") {
      pos++;
      v = new Set([...all].filter((r) => !v.has(r)));
    }
    return v;
  };
  const inter = (): Set<string> => {
    let v = primary();
    while (toks[pos]?.t === "op" && (toks[pos] as { v: string }).v === "∩") {
      pos++;
      const r = primary();
      v = new Set([...v].filter((x) => r.has(x)));
    }
    return v;
  };
  const union = (): Set<string> => {
    let v = inter();
    for (;;) {
      const tk = toks[pos];
      if (tk?.t !== "op" || tk.v === "∩") break;
      pos++;
      const r = inter();
      if (tk.v === "∪") v = new Set([...v, ...r]);
      else if (tk.v === "∖") v = new Set([...v].filter((x) => !r.has(x)));
      else v = new Set([...[...v].filter((x) => !r.has(x)), ...[...r].filter((x) => !v.has(x))]);
    }
    return v;
  };

  const result = union();
  if (pos !== toks.length) throw new Error("Unexpected symbol");
  return REGIONS[size].filter((r) => result.has(r));
}

/** Same regions (any order)? */
export function sameRegions(a: string[], b: string[]): boolean {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((r) => y.has(r));
}

/** Elements of an expression, given the elements written in each region. */
export function elementsOf(regions: string[], elements: Record<string, string[]> | undefined): string[] {
  return regions.flatMap((r) => elements?.[r] ?? []);
}
