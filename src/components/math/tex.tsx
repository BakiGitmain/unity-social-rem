"use client";

import { Fragment, memo, useMemo } from "react";
import katex from "katex";

/** One TeX formula rendered with KaTeX (crisp on every screen, real math symbols). */
export const Tex = memo(function Tex({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false, displayMode: display, output: "htmlAndMathml", strict: "ignore", trust: false }),
    [tex, display],
  );
  return <span className={display ? "tex-display" : "tex"} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Plain text with inline `$…$` formulas. */
export function MathText({ text }: { text: string }) {
  if (!text.includes("$")) return <>{text}</>;
  const parts = text.split(/\$([^$]+)\$/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <Tex key={i} tex={p} /> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

/** Text for places that need a plain string (aria labels, copy): $A \cup B$ → A ∪ B. */
export function texToPlain(text: string): string {
  return text.replace(/\$([^$]+)\$/g, (_, t: string) =>
    t
      .replace(/\\cup/g, "∪")
      .replace(/\\cap/g, "∩")
      .replace(/\\setminus/g, "∖")
      .replace(/\\notin/g, "∉")
      .replace(/\\in/g, "∈")
      .replace(/\\subseteq/g, "⊆")
      .replace(/\\subset/g, "⊂")
      .replace(/\\emptyset/g, "∅")
      .replace(/\\Delta/g, "Δ")
      .replace(/\\mathbb\{(\w)\}/g, (_m, l: string) => ({ N: "ℕ", Z: "ℤ", Q: "ℚ", R: "ℝ", W: "𝕎", I: "𝕀" })[l] ?? l)
      .replace(/\\le/g, "≤")
      .replace(/\\ne/g, "≠")
      .replace(/\\mid/g, "|")
      .replace(/\\quad|\\[,;:! ]/g, " ")
      .replace(/ {2,}/g, " ")
      .replace(/\\[{}]/g, (m) => m.slice(1))
      .replace(/\\[a-zA-Z]+/g, "")
      .replace(/[{}]/g, ""),
  );
}
