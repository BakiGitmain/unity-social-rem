"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Circle,
  Eraser,
  HelpCircle,
  Highlighter,
  Minus,
  MousePointer2,
  Type,
  PenLine,
  PenTool,
  Redo2,
  Shapes,
  Sigma,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { EMPTY_DOC, type InkDoc, type InkItem, type Paper, type Template, type WsLayout } from "@/lib/ink/model";
import { idbGet, idbSet } from "@/lib/ink/store";
import { createHistory, TEXT_SHORTCUTS } from "@/lib/ink/text";
import { InkCanvas, PEN_COLORS, PEN_SIZES, paperDrops, type CanvasApi, type Tool, type ToolState } from "@/components/ink/ink-canvas";

export const INK_SYMBOLS = ["∪", "∩", "∈", "∉", "⊆", "⊂", "∅", "{", "}", "′", "\\", "Δ", "ℕ", "ℤ", "ℚ", "ℝ"];
const spring = { type: "spring", stiffness: 520, damping: 38 } as const;

/* ------------------------------------------------------------------ document + history (saved in IndexedDB) */

export function useInkDoc(storageKey: string | null) {
  const [doc, setDoc] = useState<InkDoc>(EMPTY_DOC);
  const [loaded, setLoaded] = useState(!storageKey);
  const history = useRef(createHistory<InkItem[]>([]));
  const docRef = useRef(doc);
  const [hist, setHist] = useState({ undo: false, redo: false });
  const save = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!storageKey) return;
    let stop = false;
    void idbGet<InkDoc & { at?: number }>("docs", storageKey).then((d) => {
      if (stop) return;
      if (d && Array.isArray(d.items)) {
        const loadedDoc: InkDoc = { items: d.items, paper: d.paper ?? "lined", template: d.template ?? "none" };
        docRef.current = loadedDoc;
        history.current.reset(loadedDoc.items);
        setDoc(loadedDoc);
      }
      setLoaded(true);
    });
    return () => {
      stop = true;
    };
  }, [storageKey]);

  const persist = useCallback(
    (d: InkDoc) => {
      if (!storageKey) return;
      clearTimeout(save.current);
      save.current = setTimeout(() => void idbSet("docs", storageKey, d.items.length || d.template !== "none" ? { ...d, at: Date.now() } : undefined), 300);
    },
    [storageKey],
  );

  const apply = useCallback(
    (next: InkDoc) => {
      docRef.current = next;
      setDoc(next);
      setHist({ undo: history.current.canUndo, redo: history.current.canRedo });
      persist(next);
    },
    [persist],
  );
  const setItems = useCallback(
    (items: InkItem[]) => apply({ ...docRef.current, items: history.current.push(items) }),
    [apply],
  );
  const patch = useCallback((p: Partial<Pick<InkDoc, "paper" | "template">>) => apply({ ...docRef.current, ...p }), [apply]);
  const undo = useCallback(() => {
    if (history.current.canUndo) apply({ ...docRef.current, items: history.current.undo() });
  }, [apply]);
  const redo = useCallback(() => {
    if (history.current.canRedo) apply({ ...docRef.current, items: history.current.redo() });
  }, [apply]);
  const clear = useCallback(() => setItems([]), [setItems]);

  return { doc, loaded, setItems, patch, undo, redo, clear, canUndo: hist.undo, canRedo: hist.redo };
}

export type InkDocApi = ReturnType<typeof useInkDoc>;

/* ------------------------------------------------------------------ preferences */

const PEN_ONLY_KEY = "usr-ink-pen-only";
export function usePenOnly(): [boolean, (v: boolean) => void, boolean, () => void] {
  const [penOnly, setPenOnlyState] = useState(false);
  const [penSeen, setPenSeen] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPenOnlyState(window.localStorage.getItem(PEN_ONLY_KEY) === "1");
    } catch {}
  }, []);
  const setPenOnly = (v: boolean) => {
    setPenOnlyState(v);
    try {
      window.localStorage.setItem(PEN_ONLY_KEY, v ? "1" : "0");
    } catch {}
  };
  return [penOnly, setPenOnly, penSeen, () => setPenSeen(true)];
}

function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/* ------------------------------------------------------------------ editor = toolbar + paper */

/**
 * The full writing area: paper + tools. Desktop: slim vertical toolbar on the left (P, H, E, S shortcuts,
 * Ctrl+Z / Ctrl+Shift+Z). Phone: bottom toolbar within thumb reach.
 */
export function InkEditor({
  api,
  tint,
  className = "",
  paperClassName = "",
  autoFocusKeys = true,
  ariaLabel,
  labels,
  marks,
  heightPx,
  layout,
  toolbar = "side",
}: {
  /** "side": slim vertical bar on the left (tall papers). "top": a wrapping bar above the paper (papers inside a card). */
  toolbar?: "side" | "top";
  layout?: WsLayout;
  heightPx?: number;
  labels?: string[];
  marks?: (boolean | null)[];
  api: InkDocApi;
  tint?: string | null;
  className?: string;
  paperClassName?: string;
  /** Listen for keyboard shortcuts while mounted. */
  autoFocusKeys?: boolean;
  ariaLabel?: string;
}) {
  const [tool, setTool] = useState<ToolState>({ tool: "pen", color: PEN_COLORS[0]!, size: 1, shape: "ellipse", symbol: "∪" });
  const [panel, setPanel] = useState<null | "pen" | "shape" | "symbol" | "paper" | "help">(null);
  const [penOnly, setPenOnly, penSeen, markPen] = usePenOnly();
  const phone = useIsPhone();
  const { doc, undo, redo, clear, setItems, patch } = api;
  const canvasApi = useRef<CanvasApi | null>(null);

  const pick = (t: ToolState["tool"]) => {
    setTool((s) => ({ ...s, tool: t }));
    setPanel((p) => (t === "pen" || t === "shape" || t === "symbol" ? (p === t && tool.tool === t ? null : t) : null));
  };

  // Keyboard shortcuts.
  useEffect(() => {
    if (!autoFocusKeys) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && k === "y") {
        e.preventDefault();
        redo();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (k === "v") pick("select");
        else if (k === "t") pick("text");
        else if (k === "p") pick("pen");
        else if (k === "h") pick("highlighter");
        else if (k === "e") pick("eraser");
        else if (k === "s") pick("shape");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const btn = (active: boolean) =>
    `relative grid size-11 shrink-0 place-items-center rounded-xl transition-colors ${active ? "text-white" : "text-muted hover:bg-ink/[0.06] hover:text-ink"}`;
  const toolBtn = ({ id, label, icon: Icon, shortcut }: { id: ToolState["tool"]; label: string; icon: typeof PenLine; shortcut?: string }) => (
    <button type="button" onClick={() => pick(id)} aria-label={label} aria-pressed={tool.tool === id} title={shortcut ? `${label} (${shortcut})` : label} className={btn(tool.tool === id)}>
      {tool.tool === id && <motion.span layoutId={`ink-tool-${ariaLabel ?? "x"}`} className="absolute inset-0 rounded-xl bg-accent" transition={spring} />}
      <Icon className="relative size-5" aria-hidden />
      {id === "pen" && <span className="absolute right-1.5 bottom-1.5 size-2 rounded-full ring-1 ring-white" style={{ background: tool.color }} aria-hidden />}
    </button>
  );

  const bar = (
    <div
      role="toolbar"
      aria-label="Writing tools"
      className={
        phone
          ? "no-scrollbar flex items-center gap-1 overflow-x-auto border-t border-line bg-surface px-2 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))]"
          : toolbar === "top"
            ? "flex flex-wrap items-center gap-1 border-b border-line bg-surface px-2 py-1.5"
            : "no-scrollbar flex w-14 shrink-0 flex-col items-center gap-1 overflow-y-auto overscroll-contain border-r border-line bg-surface py-2"
      }
    >
      {toolBtn({ id: "select", label: "Select / move", icon: MousePointer2, shortcut: "V" })}
      {toolBtn({ id: "pen", label: "Pen", icon: PenLine, shortcut: "P", })}
      {toolBtn({ id: "highlighter", label: "Highlighter", icon: Highlighter, shortcut: "H", })}
      {toolBtn({ id: "text", label: "Text", icon: Type, shortcut: "T" })}
      {toolBtn({ id: "eraser", label: "Eraser (tap or scribble)", icon: Eraser, shortcut: "E", })}
      {toolBtn({ id: "shape", label: "Shapes", icon: Shapes, shortcut: "S", })}
      {toolBtn({ id: "symbol", label: "Symbols", icon: Sigma, })}
      <span className={phone || toolbar === "top" ? "mx-0.5 h-7 w-px shrink-0 bg-line" : "my-0.5 h-px w-7 shrink-0 bg-line"} aria-hidden />
      <button type="button" onClick={undo} disabled={!api.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)" className={`${btn(false)} disabled:opacity-30`}>
        <Undo2 className="size-5" aria-hidden />
      </button>
      <button type="button" onClick={redo} disabled={!api.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" className={`${btn(false)} disabled:opacity-30`}>
        <Redo2 className="size-5" aria-hidden />
      </button>
      <button type="button" onClick={clear} disabled={!doc.items.length} aria-label="Clear" title="Clear" className={`${btn(false)} disabled:opacity-30`}>
        <Trash2 className="size-5" aria-hidden />
      </button>
      <button type="button" onClick={() => setPanel((p) => (p === "paper" ? null : "paper"))} aria-label="Paper style" title="Paper" className={btn(false)}>
        <span className={`size-5 rounded-[5px] ring-1 ring-current ${doc.paper === "grid" ? "paper-grid" : doc.paper === "lined" ? "paper-lined" : ""}`} aria-hidden />
      </button>
      {penSeen && (
        <button type="button" onClick={() => setPenOnly(!penOnly)} aria-pressed={penOnly} aria-label="Pen only" title="Pen only: fingers and palm don't draw" className={btn(penOnly)}>
          {penOnly && <span className="absolute inset-0 rounded-xl bg-accent" />}
          <PenTool className="relative size-5" aria-hidden />
        </button>
      )}
      <button type="button" onClick={() => setPanel((p) => (p === "help" ? null : "help"))} aria-label="Help" className={btn(false)}>
        <HelpCircle className="size-5" aria-hidden />
      </button>
    </div>
  );

  const panelEl = (
    <AnimatePresence>
      {panel && (
        <motion.div
          key={panel}
          initial={{ opacity: 0, scale: 0.96, y: phone ? 8 : 0, x: phone ? 0 : -6 }}
          animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={spring}
          className={`absolute z-10 rounded-2xl bg-surface p-2.5 shadow-[0_12px_32px_-14px_rgba(29,42,44,0.45)] ring-1 ring-line ${
            phone ? "inset-x-2 bottom-2 max-h-[70%] overflow-y-auto" : `top-2 left-2 max-h-[calc(100%-16px)] overflow-y-auto ${panel === "help" ? "w-[300px]" : "w-[244px]"}`
          }`}
        >
          {panel === "pen" && (
            <div className="flex items-center gap-2">
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={tool.color === c}
                  onClick={() => setTool((s) => ({ ...s, color: c }))}
                  className={`size-9 rounded-full ring-offset-2 ${tool.color === c ? "ring-2 ring-ink/50" : ""}`}
                  style={{ background: c }}
                />
              ))}
              <span className="mx-1 h-7 w-px bg-line" aria-hidden />
              {PEN_SIZES.map((sz, i) => (
                <button
                  key={sz}
                  type="button"
                  aria-label={["Thin", "Medium", "Thick"][i]}
                  aria-pressed={tool.size === i}
                  onClick={() => setTool((s) => ({ ...s, size: i as 0 | 1 | 2 }))}
                  className={`grid size-9 place-items-center rounded-xl ${tool.size === i ? "bg-accent-soft" : "hover:bg-ink/[0.05]"}`}
                >
                  <span className="rounded-full bg-ink" style={{ width: sz * 2, height: sz * 2 }} />
                </button>
              ))}
            </div>
          )}
          {panel === "shape" && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                {(
                  [
                    ["line", Minus, "Line"],
                    ["arrow", ArrowUpRight, "Arrow"],
                    ["rect", Square, "Rectangle"],
                    ["ellipse", Circle, "Circle / ellipse"],
                  ] as const
                ).map(([k, Icon, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={label}
                    aria-pressed={tool.shape === k}
                    onClick={() => setTool((s) => ({ ...s, tool: "shape", shape: k }))}
                    className={`grid size-11 place-items-center rounded-xl ${tool.shape === k ? "bg-accent text-white" : "text-muted hover:bg-ink/[0.05]"}`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {(["venn2", "venn3"] as Template[]).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    aria-pressed={doc.template === tp}
                    onClick={() => patch({ template: doc.template === tp ? "none" : tp })}
                    className={`flex-1 rounded-xl px-2 py-2 text-xs font-medium ${doc.template === tp ? "bg-accent text-white" : "bg-ink/[0.05] text-ink"}`}
                  >
                    Venn: {tp === "venn2" ? "2 sets" : "3 sets"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-snug text-faint">Tip: with the pen, draw a rough circle or box and hold still for a moment: it snaps into shape.</p>
            </div>
          )}
          {panel === "symbol" && (
            <SymbolTray
              active={tool.symbol}
              // while typing a text box: insert at the cursor; otherwise tap the paper to place it
              onPick={(s) => canvasApi.current?.insert(s) || setTool((t) => ({ ...t, tool: "symbol", symbol: s }))}
            />
          )}
          {panel === "paper" && (
            <div className="flex gap-1.5">
              {(["lined", "grid", "blank"] as Paper[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={doc.paper === p}
                  onClick={() => {
                    patch({ paper: p });
                    setPanel(null);
                  }}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm capitalize ${doc.paper === p ? "bg-accent text-white" : "bg-ink/[0.05] text-ink"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          {panel === "help" && (
            <div className="space-y-1 text-[13px] leading-snug text-ink/85">
              <p>✍️ Write with your finger, mouse or pen. Two fingers move and zoom the paper.</p>
              <p>🧽 Eraser: tap a stroke, or scribble over it.</p>
              <p>⭕ Shapes: draw a rough circle or box and hold to snap it.</p>
              <p>∪ Symbols: tap one, then tap the paper, or drag it onto the paper. While typing, a tap inserts it at the cursor.</p>
              <p>T Text: tap anywhere and type. Esc or tap outside to finish; double-tap a text box to edit it.</p>
              <p>➚ Select: tap an item, drag to move, corners resize, the round handle rotates. Drag on empty paper to select several. On a phone: long-press an item.</p>
              <p className="pt-1 font-medium">Typing shortcuts</p>
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[12px]">
                {TEXT_SHORTCUTS.map(([k, v]) => (
                  <span key={k}>
                    {k} → {v}
                  </span>
                ))}
              </p>
              {!phone && <p className="text-faint">Keys: V select · P pen · H highlighter · T text · E eraser · S shapes · Del delete · Ctrl+D duplicate · Ctrl+Z undo · Ctrl+Shift+Z redo</p>}
            </div>
          )}
          <button type="button" onClick={() => setPanel(null)} aria-label="Close" className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-surface text-muted shadow ring-1 ring-line">
            <X className="size-3.5" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      className={`flex min-h-0 overflow-hidden ${phone ? "flex-col-reverse" : toolbar === "top" ? "flex-col" : "flex-row"} ${className}`}
      style={heightPx ? { height: heightPx + (phone ? 56 : toolbar === "top" ? 104 : 0) } : undefined}
    >
      {bar}
      <div className="relative min-h-0 min-w-0 flex-1">
        <InkCanvas
          doc={doc}
          onItems={setItems}
          tool={tool}
          onToolChange={(t: Tool) => setTool((s) => ({ ...s, tool: t }))}
          apiRef={canvasApi}
          penOnly={penOnly}
          onPen={markPen}
          tint={tint}
          className={`h-full ${paperClassName}`}
          ariaLabel={ariaLabel}
          labels={labels}
          marks={marks}
          layout={layout}
        />
        {panelEl}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ symbols tray (tap or drag onto the paper) */

function SymbolTray({ active, onPick }: { active: string; onPick: (s: string) => void }) {
  return (
    <div>
      <div className="grid grid-cols-8 gap-1">
        {INK_SYMBOLS.map((s) => (
          <DragSymbol key={s} symbol={s} active={active === s} onPick={onPick} />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-faint">Tap a symbol then the paper, or drag it onto the paper.</p>
    </div>
  );
}

function DragSymbol({ symbol, active, onPick }: { symbol: string; active: boolean; onPick: (s: string) => void }) {
  const d = useRef<{ x: number; y: number; ghost: HTMLDivElement | null } | null>(null);
  return (
    <button
      type="button"
      aria-label={`Symbol ${symbol}`}
      aria-pressed={active}
      onPointerDown={(e) => {
        e.preventDefault(); // keep the text cursor (and focus) while typing
        e.currentTarget.setPointerCapture(e.pointerId);
        d.current = { x: e.clientX, y: e.clientY, ghost: null };
      }}
      onPointerMove={(e) => {
        const s = d.current;
        if (!s) return;
        if (!s.ghost && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) {
          const g = document.createElement("div");
          g.textContent = symbol;
          g.setAttribute("aria-hidden", "true");
          g.style.cssText =
            "position:fixed;left:0;top:0;z-index:120;pointer-events:none;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:var(--accent);color:#fff;font-size:22px;font-weight:600;box-shadow:0 10px 24px -8px rgba(0,0,0,.35)";
          document.body.appendChild(g);
          s.ghost = g;
        }
        if (s.ghost) s.ghost.style.transform = `translate(${e.clientX - 22}px, ${e.clientY - 46}px)`;
      }}
      onPointerUp={(e) => {
        const s = d.current;
        d.current = null;
        if (!s) return;
        if (!s.ghost) return onPick(symbol);
        s.ghost.remove();
        const paper = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-ink-paper]");
        if (paper) paperDrops.get(paper)?.(e.clientX, e.clientY - 24, symbol);
      }}
      onPointerCancel={() => {
        d.current?.ghost?.remove();
        d.current = null;
      }}
      className={`grid h-11 touch-none place-items-center rounded-xl text-[20px] select-none ${active ? "bg-accent text-white" : "bg-ink/[0.04] text-ink hover:bg-ink/[0.08]"}`}
    >
      {symbol}
    </button>
  );
}
