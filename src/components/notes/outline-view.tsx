"use client";

import { ArrowRight, Quote } from "lucide-react";
import { NoteMarkdown } from "@/components/notes/note-markdown";
import { buildOutline, type OutlineItem } from "@/lib/notes/outline";
import type { BoardEdge, BoardNode } from "@/lib/notes/types";

/** The whole board as a clean nested list: reading mode on small phones, and what gets printed (PDF). */
export function OutlineView({
  nodes,
  edges,
  title,
  lessonLabel,
  onOpen,
}: {
  nodes: BoardNode[];
  edges: BoardEdge[];
  title: string;
  lessonLabel?: string;
  onOpen?: (id: string) => void;
}) {
  const items = buildOutline(nodes, edges);
  return (
    <article id="notes-outline" className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      {lessonLabel && <p className="mt-1 text-sm text-muted">{lessonLabel}</p>}
      {!items.length && <p className="mt-8 text-muted">This board is empty.</p>}
      <ol className="mt-6 space-y-3">
        {items.map((it) => (
          <Item key={it.node.id} it={it} depth={0} onOpen={onOpen} />
        ))}
      </ol>
    </article>
  );
}

function Item({ it, depth, onOpen }: { it: OutlineItem; depth: number; onOpen?: (id: string) => void }) {
  const n = it.node;
  const frame = n.type === "frame";
  return (
    <li className={frame ? "rounded-2xl bg-ink/[0.03] p-3 ring-1 ring-line" : "rounded-2xl bg-surface p-3.5 ring-1 ring-line break-inside-avoid"}>
      <button
        type="button"
        onClick={() => onOpen?.(n.id)}
        className={`text-left font-semibold text-ink hover:underline ${frame ? "text-xs tracking-wide text-accent-ink uppercase" : depth ? "text-[15px]" : "text-base"}`}
      >
        {it.title}
      </button>
      {n.type === "quote" && n.data.quote && (
        <p className="mt-1 flex gap-1.5 text-[15px] text-ink/85 italic">
          <Quote className="mt-1 size-3.5 shrink-0 text-accent" aria-hidden />
          {n.data.quote.text}
        </p>
      )}
      {(n.type === "note" || n.type === "sticky") && n.data.body && (
        <div className="mt-1 text-[15px] leading-relaxed text-ink/85">
          <NoteMarkdown text={n.data.body} />
        </div>
      )}
      {n.type === "checklist" && (
        <ul className="mt-1 space-y-0.5 text-[15px]">
          {(n.data.items ?? []).map((i) => (
            <li key={i.id} className={i.done ? "text-muted line-through" : "text-ink/85"}>
              {i.done ? "☑" : "☐"} {i.text}
            </li>
          ))}
        </ul>
      )}
      {n.type === "link" && n.data.link?.url && (
        <a href={n.data.link.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-accent-ink underline">
          {n.data.link.url}
        </a>
      )}
      {(n.type === "image" || n.type === "drawing") && <p className="mt-1 text-sm text-muted">({n.type === "image" ? "Image" : "Drawing"} on the board)</p>}
      {it.links.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {it.links.map((l, i) => (
            <li key={i} className="flex items-center gap-1.5 text-sm text-muted">
              <ArrowRight className="size-3.5 text-accent" aria-hidden />
              linked to <span className="font-medium text-ink">{l.to}</span>
              {l.label && <span className="rounded-full bg-accent-soft px-2 text-xs text-accent-ink">{l.label}</span>}
            </li>
          ))}
        </ul>
      )}
      {it.children.length > 0 && (
        <ol className="mt-2.5 space-y-2.5">
          {it.children.map((c) => (
            <Item key={c.node.id} it={c} depth={depth + 1} onOpen={onOpen} />
          ))}
        </ol>
      )}
    </li>
  );
}
