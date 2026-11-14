"use client";

import { memo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Check, Copy } from "lucide-react";
import { EMOJI_SECTION, SectionIcon } from "@/components/math/solution-guide";

/* ------------------------------------------------------------------ section emojis → the template's icons */

const EMOJI_RE = /^\s*(📌|📋|🔧|👣|✅|⚠️|⚠|💡)️?\s*/u;
/** A paragraph / list item that starts with a template emoji ("💡 Tip: …") gets the same coloured icon as the
 *  solution template instead of the emoji. */
function withIcon(children: ReactNode): ReactNode {
  const list = Array.isArray(children) ? children : [children];
  const first = list[0];
  if (typeof first !== "string") return children;
  const m = first.match(EMOJI_RE);
  const kind = m && EMOJI_SECTION[m[1]!];
  if (!m || !kind) return children;
  return (
    <span className="flex items-start gap-2">
      <SectionIcon kind={kind} className="-mt-0.5" />
      <span className="min-w-0 flex-1">
        {first.slice(m[0].length)}
        {list.slice(1)}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ copy button (code + math blocks) */

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      aria-label={done ? "Copied" : "Copy"}
      title={done ? "Copied" : "Copy"}
      className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-lg bg-surface/90 text-muted opacity-70 ring-1 ring-line transition-opacity hover:text-ink hover:opacity-100 focus-visible:opacity-100"
    >
      {done ? <Check className="size-3.5 text-good" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

/** Plain text of a React tree (for copying a code block). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/* ------------------------------------------------------------------ rehype: wrap display math (after KaTeX) */

type HNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HNode[] };
const hasClass = (n: HNode, c: string) => {
  const cls = n.properties?.className;
  return Array.isArray(cls) ? cls.includes(c) : typeof cls === "string" && cls.split(" ").includes(c);
};
const findTex = (n: HNode): string => {
  if (n.type === "element" && n.tagName === "annotation" && n.properties?.encoding === "application/x-tex") return (n.children ?? []).map((c) => c.value ?? "").join("");
  for (const c of n.children ?? []) {
    const t = findTex(c);
    if (t) return t;
  }
  return "";
};
/** Wraps every KaTeX display block in <div class="math-block" data-tex="…"> so it can get a copy button. */
function rehypeMathBlocks() {
  const walk = (n: HNode) => {
    if (!n.children) return;
    n.children = n.children.map((c) => {
      if (c.type === "element" && hasClass(c, "katex-display")) {
        return { type: "element", tagName: "div", properties: { className: ["math-block"], dataTex: findTex(c) }, children: [c] };
      }
      walk(c);
      return c;
    });
  };
  return (tree: HNode) => walk(tree);
}

/* ------------------------------------------------------------------ components */

const components: Components = {
  p: ({ children }) => <p className="mb-2.5 last:mb-0">{withIcon(children)}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0 marker:text-accent">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0 marker:font-semibold marker:text-accent">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{withIcon(children)}</li>,
  h1: ({ children }) => <p className="mb-1.5 text-[16px] font-semibold text-ink">{children}</p>,
  h2: ({ children }) => <p className="mb-1.5 text-[16px] font-semibold text-ink">{children}</p>,
  h3: ({ children }) => <p className="mb-1.5 font-semibold text-ink">{children}</p>,
  h4: ({ children }) => <p className="mb-1 font-semibold text-ink">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2.5 border-l-2 border-accent/60 pl-3 text-ink/75 last:mb-0">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent-ink underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children, className }) =>
    className ? <code className={className}>{children}</code> : <code className="rounded bg-ink/[0.06] px-1 py-0.5 text-[0.9em]">{children}</code>,
  pre: ({ children }) => (
    <div className="relative mb-2.5 last:mb-0">
      <pre className="overflow-x-auto rounded-xl bg-ink/[0.04] p-3 pr-10 text-[13px]">{children}</pre>
      <CopyButton text={textOf(children).replace(/\n$/, "")} />
    </div>
  ),
  div: ({ children, className, ...rest }) => {
    const tex = (rest as { "data-tex"?: string })["data-tex"];
    if (className?.includes("math-block")) {
      return (
        <div className="relative mb-2.5 overflow-x-auto rounded-xl bg-ink/[0.03] px-3 py-1 pr-10 last:mb-0">
          {children}
          {tex && <CopyButton text={tex} />}
        </div>
      );
    }
    return <div className={className}>{children}</div>;
  },
  // Tables scroll sideways on small screens instead of squeezing.
  table: ({ children }) => (
    <div className="mb-2.5 max-w-full overflow-x-auto overscroll-x-contain rounded-xl ring-1 ring-line last:mb-0">
      <table className="w-full border-collapse text-left text-[13.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line bg-[var(--accent-tint)] px-2.5 py-1.5 font-semibold whitespace-nowrap text-ink">{children}</th>,
  td: ({ children }) => <td className="min-w-[6.5rem] border-b border-line px-2.5 py-1.5 align-top last:border-b-0">{children}</td>,
  hr: () => <hr className="my-3 border-line" />,
  img: () => null,
};

/**
 * Safe Markdown (no raw HTML, no images) for chat messages: headings, bold, numbered steps, lists, GFM tables
 * (scroll sideways on phones) and math ($…$ inline, $$…$$ blocks) with KaTeX. Code and math blocks get a copy button.
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", output: "htmlAndMathml" }], rehypeMathBlocks]}
      components={components}
    >
      {text}
    </ReactMarkdown>
  );
});
