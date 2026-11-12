"use client";

import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Bold, CheckSquare, Heading, Highlighter, ImagePlus, Link2, List, MoreHorizontal, Quote, Sigma, Sparkles, Trash2 } from "lucide-react";
import { NoteMarkdown } from "@/components/notes/note-markdown";
import { InkCanvas } from "@/components/ink/ink-canvas";
import type { InkDoc } from "@/lib/ink/model";
import { uid, type BoardNode, type CardColor, type CardData, type ChecklistItem } from "@/lib/notes/types";

/** Soft card colours. */
export const COLOR_BG: Record<CardColor, string> = {
  white: "#ffffff",
  yellow: "#fef6c7",
  green: "#e3f5e6",
  blue: "#e6f0fb",
  pink: "#fde8ee",
  orange: "#fdeedd",
};

export type BoardCtx = {
  update: (id: string, patch: Partial<CardData>, opts?: { record?: boolean }) => void;
  editingId: string | null;
  setEditing: (id: string | null) => void;
  openMenu: (id: string, x: number, y: number) => void;
  openDrawing: (id: string) => void;
  uploadImage: (id: string, file: File) => void;
  imageSrc: (n: BoardNode) => string | null;
  flashIds: Set<string>;
  matches: Set<string>;
  connectFrom: string | null;
  phone: boolean;
  am: boolean;
};
export const BoardContext = createContext<BoardCtx | null>(null);
const useBoardCtx = () => useContext(BoardContext)!;

export type CardNodeData = { node: BoardNode };

const MIN: Record<string, [number, number]> = { frame: [220, 160], sticky: [140, 120], link: [180, 72], image: [120, 90] };

/** One card on the board (React Flow custom node). */
export const CardNode = memo(function CardNode({ data, selected }: NodeProps & { data: CardNodeData }) {
  const ctx = useBoardCtx();
  const n = data.node;
  const editing = ctx.editingId === n.id && !ctx.phone;
  const [minW, minH] = MIN[n.type] ?? [160, 90];
  const bg = n.type === "frame" ? "transparent" : n.type === "sticky" ? COLOR_BG[n.data.color ?? "yellow"] : COLOR_BG[n.data.color ?? "white"];
  const match = ctx.matches.has(n.id);

  return (
    <div
      className={`notes-card group relative h-full w-full rounded-2xl ${n.type === "frame" ? "notes-frame" : "notes-pop"} ${
        match ? "ring-2 ring-[#f59e0b] ring-offset-2" : ""
      } ${ctx.connectFrom && ctx.connectFrom !== n.id ? "cursor-crosshair" : ""}`}
      style={{ background: bg }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (n.type === "drawing") ctx.openDrawing(n.id);
        else ctx.setEditing(n.id);
      }}
      aria-label={`${n.type} card${n.data.title ? `: ${n.data.title}` : ""}`}
    >
      <NodeResizer isVisible={selected && !editing} minWidth={minW} minHeight={minH} lineClassName="!border-accent/40" handleClassName="!size-2.5 !rounded-sm !border-accent !bg-white" />
      {(["Top", "Right", "Bottom", "Left"] as const).map((p) => (
        <Handle key={p} id={p} type="source" position={Position[p]} className="notes-handle" />
      ))}

      {/* card menu (also: long-press / right-click) */}
      {n.type !== "frame" && (
        <button
          type="button"
          aria-label="Card menu"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            ctx.openMenu(n.id, r.left, r.bottom);
          }}
          className={`nodrag absolute top-1.5 right-1.5 z-10 grid size-7 place-items-center rounded-lg text-muted transition-opacity hover:bg-ink/[0.06] ${
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
      )}
      {ctx.flashIds.has(n.id) && (
        <span className="absolute -top-2 -left-2 z-10 grid size-6 place-items-center rounded-full bg-accent text-white shadow" title="Flashcard">
          <Sparkles className="size-3.5" aria-hidden />
        </span>
      )}

      <div className={`h-full w-full overflow-hidden ${n.type === "frame" ? "" : "p-3.5"}`}>
        <CardBody n={n} editing={editing} />
      </div>
    </div>
  );
});

function CardBody({ n, editing }: { n: BoardNode; editing: boolean }) {
  const ctx = useBoardCtx();
  const d = n.data;
  switch (n.type) {
    case "frame":
      return (
        <div className="flex h-full flex-col">
          {editing ? (
            <TitleInput n={n} className="m-2 bg-white/80 text-sm font-semibold" />
          ) : (
            <p className="m-2 w-fit max-w-[90%] truncate rounded-lg bg-white/80 px-2.5 py-1 text-sm font-semibold text-ink/80">{d.title || "Group"}</p>
          )}
        </div>
      );
    case "quote":
      return (
        <div className="flex h-full flex-col border-l-4 border-accent/60 pl-3">
          <Quote className="size-4 shrink-0 text-accent" aria-hidden />
          <p className="mt-1 line-clamp-[8] flex-1 text-[14px] leading-snug text-ink/90 italic">{d.quote?.text}</p>
          {d.quote?.href && (
            <Link href={d.quote.href} className="nodrag mt-1.5 truncate text-xs font-medium text-accent-ink underline underline-offset-2" onPointerDown={(e) => e.stopPropagation()}>
              ↗ {d.quote.lessonLabel ?? "Lesson"}
              {d.quote.part ? ` · part ${d.quote.part}` : ""}
            </Link>
          )}
        </div>
      );
    case "image": {
      const src = ctx.imageSrc(n);
      return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={d.image?.alt || d.title || "Image"} className="h-full w-full rounded-xl object-contain" draggable={false} />
      ) : (
        <label className="nodrag grid h-full cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line-strong text-center text-sm text-muted hover:bg-ink/[0.03]">
          <span className="grid place-items-center gap-1">
            <ImagePlus className="size-6" aria-hidden />
            Add a photo (max 2 MB)
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && ctx.uploadImage(n.id, e.target.files[0])} />
        </label>
      );
    }
    case "drawing": {
      const doc = (d.drawing as InkDoc | undefined) ?? { items: [], paper: "blank", template: "none" };
      return (
        <div className="relative h-full overflow-hidden rounded-xl ring-1 ring-line">
          <InkCanvas doc={doc} readOnly fit className="absolute inset-0" ariaLabel={d.title || "Drawing"} />
          {!doc.items.length && <span className="absolute inset-0 grid place-items-center text-sm text-faint">Double-click to draw ✏️</span>}
        </div>
      );
    }
    case "link":
      return editing ? (
        <div className="nodrag space-y-1.5">
          <TitleInput n={n} placeholder="Title" className="text-sm font-semibold" />
          <input
            defaultValue={d.link?.url ?? ""}
            placeholder="https://…"
            aria-label="Link address"
            onBlur={(e) => ctx.update(n.id, { link: { ...d.link, url: normalizeUrl(e.target.value) } })}
            className="w-full rounded-lg bg-white/80 px-2 py-1 text-sm ring-1 ring-line"
          />
        </div>
      ) : (
        <a
          href={d.link?.url || undefined}
          target="_blank"
          rel="noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          className="nodrag flex h-full items-center gap-2.5"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Link2 className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{d.title || d.link?.title || "Link"}</span>
            <span className="block truncate text-xs text-muted">{d.link?.url ? hostOf(d.link.url) : "Double-click to add a link"}</span>
          </span>
        </a>
      );
    case "checklist":
      return <Checklist n={n} editing={editing} />;
    default:
      return editing ? <TextEditor n={n} /> : <TextView n={n} />;
  }
}

function TextView({ n }: { n: BoardNode }) {
  const d = n.data;
  const sticky = n.type === "sticky";
  return (
    <div className={`h-full overflow-hidden text-[13.5px] leading-snug text-ink/90 ${sticky ? "font-hand text-[16px]" : ""}`}>
      {d.title && <p className={`mb-1 pr-6 font-semibold text-ink ${sticky ? "text-[17px]" : "text-[15px]"}`}>{d.title}</p>}
      {d.body ? <NoteMarkdown text={d.body} /> : !d.title && <p className="text-faint">Double-click to write</p>}
    </div>
  );
}

function TitleInput({ n, className = "", placeholder = "Title" }: { n: BoardNode; className?: string; placeholder?: string }) {
  const ctx = useBoardCtx();
  return (
    <input
      autoFocus
      defaultValue={n.data.title ?? ""}
      placeholder={placeholder}
      aria-label="Title"
      onBlur={(e) => ctx.update(n.id, { title: e.target.value.slice(0, 200) })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") ctx.setEditing(null);
      }}
      className={`nodrag w-full rounded-lg px-2 py-1 ring-1 ring-line ${className}`}
    />
  );
}

/** Inline editor (desktop) for note and sticky cards: a format toolbar + plain text with light markup. */
export function TextEditor({ n, big = false }: { n: BoardNode; big?: boolean }) {
  const ctx = useBoardCtx();
  const [title, setTitle] = useState(n.data.title ?? "");
  const [body, setBody] = useState(n.data.body ?? "");
  const ta = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const save = () => {
    if (done.current) return;
    done.current = true;
    ctx.update(n.id, { title: title.slice(0, 200), body: body.slice(0, 20000) });
    ctx.setEditing(null);
  };
  useEffect(() => {
    if (!big) ta.current?.focus();
  }, [big]);

  const wrap = (before: string, after = before, placeholder = "text") => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart,
      e = el.selectionEnd;
    const sel = body.slice(s, e) || placeholder;
    const next = body.slice(0, s) + before + sel + after + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  const line = (prefix: string) => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart;
    const start = body.lastIndexOf("\n", s - 1) + 1;
    setBody(body.slice(0, start) + prefix + body.slice(start));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, s + prefix.length);
    });
  };
  const TOOLS: [string, typeof Bold][] = [
    ["Heading", Heading],
    ["Bold", Bold],
    ["List", List],
    ["Checklist", CheckSquare],
    ["Highlight", Highlighter],
    ["Link", Link2],
    ["Math", Sigma],
  ];
  /** Runs in the click handler (it reads the text box's selection). */
  const apply = (label: string) => {
    if (label === "Heading") line("## ");
    else if (label === "Bold") wrap("**");
    else if (label === "List") line("- ");
    else if (label === "Checklist") line("- [ ] ");
    else if (label === "Highlight") wrap("==");
    else if (label === "Link") wrap("[", "](https://)", "link text");
    else wrap("$", "$", "x^2");
  };

  return (
    <div
      className="nodrag nowheel flex h-full flex-col gap-1.5"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") save();
        e.stopPropagation(); // the board's shortcuts don't fire while typing
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        aria-label="Title"
        className={`w-full rounded-lg bg-white/70 px-2 py-1 font-semibold ring-1 ring-line ${big ? "text-lg" : "text-[14px]"}`}
      />
      <div className="flex flex-wrap gap-0.5" role="toolbar" aria-label="Formatting">
        {TOOLS.map(([label, Icon]) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(label)}
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-ink/[0.07] hover:text-ink"
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        ))}
      </div>
      <textarea
        ref={ta}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={"Write your notes…\n- a list\n- [ ] a checklist\n==highlight==  $x^2$"}
        aria-label="Card text"
        className={`min-h-0 w-full flex-1 resize-none rounded-lg bg-white/70 px-2 py-1.5 leading-snug ring-1 ring-line ${big ? "text-[16px]" : "text-[13px]"}`}
      />
      {big && (
        <button type="button" onClick={save} className="h-11 rounded-full bg-accent font-medium text-white">
          Done
        </button>
      )}
    </div>
  );
}

function Checklist({ n, editing }: { n: BoardNode; editing: boolean }) {
  const ctx = useBoardCtx();
  const items = n.data.items ?? [];
  const set = (next: ChecklistItem[]) => ctx.update(n.id, { items: next });
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div className="nodrag nowheel flex h-full flex-col">
      <p className="mb-1.5 flex items-center gap-2 pr-6 text-[15px] font-semibold text-ink">
        {n.data.title || "To do"}
        {items.length > 0 && <span className="text-xs font-normal text-muted tabular-nums">{doneCount}/{items.length}</span>}
      </p>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 text-[13.5px]">
            <input
              type="checkbox"
              checked={it.done}
              aria-label={it.text || "item"}
              onChange={() => set(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
              className="size-4 accent-[var(--accent)]"
            />
            {editing ? (
              <input
                defaultValue={it.text}
                aria-label="Item"
                onBlur={(e) => set(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))}
                className="min-w-0 flex-1 rounded bg-white/80 px-1.5 ring-1 ring-line"
              />
            ) : (
              <span className={`min-w-0 flex-1 ${it.done ? "text-muted line-through" : "text-ink/90"}`}>{it.text}</span>
            )}
            {editing && (
              <button type="button" aria-label="Remove item" onClick={() => set(items.filter((x) => x.id !== it.id))} className="text-faint hover:text-bad">
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("item") as HTMLInputElement;
          if (!input.value.trim()) return;
          set([...items, { id: uid(), text: input.value.trim().slice(0, 300), done: false }]);
          input.value = "";
        }}
      >
        <input name="item" placeholder="+ Add item" aria-label="Add an item" className="w-full rounded-lg bg-white/70 px-2 py-1 text-[13px] ring-1 ring-line" />
      </form>
    </div>
  );
}

export const normalizeUrl = (u: string) => {
  const s = u.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};
const hostOf = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
};
