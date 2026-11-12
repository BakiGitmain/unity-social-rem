"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/** ==highlight== → GFM strikethrough syntax, rendered as <mark> below (no raw HTML is ever allowed). */
const prep = (s: string) => s.replace(/==([^=\n]+)==/g, "~~$1~~");

const components: Components = {
  h1: ({ children }) => <p className="mb-1 text-[15px] font-semibold text-ink">{children}</p>,
  h2: ({ children }) => <p className="mb-1 text-[14px] font-semibold text-ink">{children}</p>,
  h3: ({ children }) => <p className="mb-1 text-[13px] font-semibold text-ink">{children}</p>,
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  del: ({ children }) => <mark className="rounded-sm bg-[#fde68a] px-0.5 text-ink">{children}</mark>,
  ul: ({ children, className }) => (
    <ul className={`mb-1.5 space-y-0.5 last:mb-0 ${className?.includes("contains-task-list") ? "pl-0" : "list-disc pl-4"}`}>{children}</ul>
  ),
  ol: ({ children }) => <ol className="mb-1.5 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
  li: ({ children, className }) => <li className={className?.includes("task-list-item") ? "flex list-none items-start gap-1.5" : ""}>{children}</li>,
  input: ({ checked }) => <input type="checkbox" checked={!!checked} readOnly className="mt-1 accent-[var(--accent)]" aria-label={checked ? "done" : "to do"} />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent-ink underline underline-offset-2" onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-ink/[0.06] px-1 text-[0.92em]">{children}</code>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/50 pl-2 text-ink/75">{children}</blockquote>,
  img: () => null,
};

/** Card text (a single newline stays a line break): headings, **bold**, lists, - [ ] checklists, ==highlight==, links and $math$ (KaTeX). */
export const NoteMarkdown = memo(function NoteMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]} components={components}>
      {prep(text)}
    </ReactMarkdown>
  );
});
