"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const components: Components = {
  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0 marker:text-accent">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0 marker:text-accent">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  h1: ({ children }) => <p className="mb-1.5 font-semibold text-ink">{children}</p>,
  h2: ({ children }) => <p className="mb-1.5 font-semibold text-ink">{children}</p>,
  h3: ({ children }) => <p className="mb-1.5 font-semibold text-ink">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2.5 border-l-2 border-accent/60 pl-3 text-ink/75 last:mb-0">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent-ink underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-ink/[0.06] px-1 py-0.5 text-[0.9em]">{children}</code>,
  pre: ({ children }) => <pre className="mb-2.5 overflow-x-auto rounded-xl bg-ink/[0.04] p-3 text-[13px]">{children}</pre>,
  table: ({ children }) => (
    <div className="mb-2.5 overflow-x-auto rounded-xl ring-1 ring-line last:mb-0">
      <table className="w-full border-collapse text-left text-[13.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line bg-[var(--accent-tint)] px-2.5 py-1.5 font-semibold text-ink">{children}</th>,
  td: ({ children }) => <td className="border-b border-line px-2.5 py-1.5 align-top last:border-b-0">{children}</td>,
  hr: () => <hr className="my-3 border-line" />,
  img: () => null,
};

/** Small, safe Markdown (no raw HTML, no images) for chat messages. Math in $…$ / $…$ is rendered with KaTeX. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", output: "htmlAndMathml" }]]} components={components}>
      {text}
    </ReactMarkdown>
  );
});
