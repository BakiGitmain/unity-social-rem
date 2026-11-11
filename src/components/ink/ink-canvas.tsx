"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, ArrowUpToLine, Bold, Check, Copy, Trash2, Type } from "lucide-react";
import {
  hitItem,
  inkBounds,
  itemBounds,
  itemsHit,
  newId,
  recognizeShape,
  ROW_TOP,
  rowHeight,
  worksheetHeight,
  type Box,
  type InkDoc,
  type InkItem,
  type InkStroke,
  type InkText,
  type ShapeKind,
  type WsLayout,
} from "@/lib/ink/model";
import { drawItem, drawItems, drawSelection, drawTemplate, drawWorksheet, measureText, rotateHandle, selectionHandles, textFont, LINE } from "@/lib/ink/render";
import { boxSelect, deleteItems, duplicateItems, itemAt, moveItems, reorder, rotateItems, scaleItems, selectionBox, snap, type Guide } from "@/lib/ink/transform";
import { autoFormat } from "@/lib/ink/text";

export type Tool = "select" | "pen" | "highlighter" | "text" | "eraser" | "shape" | "symbol";
export type ToolState = { tool: Tool; color: string; size: 0 | 1 | 2; shape: ShapeKind; symbol: string };

export const PEN_COLORS = ["#1d2a2c", "#2563eb", "#dc2626", "#15803d"];
export const PEN_SIZES = [2.4, 3.8, 6.2];
export const TEXT_SIZES = { S: 20, M: 26, L: 36 } as const;
const HIGHLIGHT = "#facc15";

/** Paper elements register a "place symbol at screen point" function, so a symbol dragged from the tray lands there. */
export const paperDrops = new WeakMap<Element, (clientX: number, clientY: number, text: string) => void>();

/** What the toolbar can ask the paper to do (insert a symbol into the text being typed). */
export type CanvasApi = { insert: (text: string) => boolean };

type View = { x: number; y: number; k: number };
type Gesture = { kind: "pinch" | "pan"; mid: [number, number]; dist: number; view: View };
type Editing = { id: string | null; x: number; y: number; value: string; size: number; color: string; bold: boolean; font: "hand" | "sans" };
type Drag =
  | { mode: "move"; start: [number, number]; orig: InkItem[]; box: Box }
  | { mode: "resize"; orig: InkItem[]; box: Box; anchor: [number, number] }
  | { mode: "rotate"; orig: InkItem[]; center: [number, number]; a0: number }
  | { mode: "box"; start: [number, number]; additive: boolean; base: Set<string> };

const ROTATABLE = (it: InkItem) => it.type !== "stroke";

/**
 * The paper: draws ink (vector items) on a canvas with devicePixelRatio, one requestAnimationFrame per frame.
 * Tools: select / move (tap, box-select, move, resize, rotate, snap guides), pen / highlighter (perfect-freehand),
 * text (tap anywhere and type), eraser (tap or scribble), shapes + smart shapes, symbols.
 * Two fingers = pan / zoom, never draw. "Pen only": a finger or palm never draws. Long-press an item = select it.
 */
export function InkCanvas({
  doc,
  onItems,
  tool,
  onToolChange,
  apiRef,
  penOnly = false,
  onPen,
  tint = null,
  readOnly = false,
  fit = false,
  zoomable = true,
  className = "",
  ariaLabel = "Writing paper",
  labels,
  marks,
  layout = "side",
}: {
  layout?: WsLayout;
  /** Worksheet: one labelled answer line per part ("A ∪ B = ____"). */
  labels?: string[];
  /** ✓ / ✗ next to each line after checking. */
  marks?: (boolean | null)[];
  doc: InkDoc;
  onItems?: (items: InkItem[]) => void;
  tool?: ToolState;
  onToolChange?: (t: Tool) => void;
  apiRef?: React.RefObject<CanvasApi | null>;
  penOnly?: boolean;
  /** Called the first time a stylus touches the paper (to offer "Pen only"). */
  onPen?: () => void;
  tint?: string | null;
  readOnly?: boolean;
  /** Preview: scale the ink down to fit (the collapsed strip). */
  fit?: boolean;
  zoomable?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const view = useRef<View>({ x: 0, y: 0, k: 1 });
  const live = useRef<InkItem | null>(null);
  const marked = useRef<Set<string>>(new Set());
  const erasePath = useRef<[number, number][]>([]);
  const moving = useRef<{ id: string; dx: number; dy: number; items: InkItem[] } | null>(null);
  const preview = useRef<InkItem[] | null>(null);
  const drag = useRef<Drag | null>(null);
  const guides = useRef<Guide[]>([]);
  const boxRect = useRef<Box | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number; type: string; sx: number; sy: number }>());
  const gesture = useRef<Gesture | null>(null);
  const drawingId = useRef<number | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPress = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTap = useRef<{ id: string; t: number } | null>(null);
  const snapped = useRef(false);
  const frame = useRef(0);
  const [sel, setSelState] = useState<Set<string>>(new Set());
  const selRef = useRef(sel);
  const [editing, setEditingState] = useState<Editing | null>(null);
  const editingRef = useRef<Editing | null>(null);
  const [busy, setBusy] = useState(false); // dragging: hide the floating bar
  // For the floating bar / text input (rendered by React): the view and the paper width, as state.
  const [vs, setVs] = useState<View>({ x: 0, y: 0, k: 1 });
  const [paperW, setPaperW] = useState(0);
  const docRef = useRef(doc);
  const labelsRef = useRef(labels);
  const marksRef = useRef(marks);
  const layoutRef = useRef(layout);
  const opts = useRef({ tool, penOnly, tint, onItems, onPen, readOnly, onToolChange });
  // Event handlers read the latest props through refs (synced after every render).
  useLayoutEffect(() => {
    docRef.current = doc;
    labelsRef.current = labels;
    marksRef.current = marks;
    layoutRef.current = layout;
    opts.current = { tool, penOnly, tint, onItems, onPen, readOnly, onToolChange };
  });

  const setSel = (s: Set<string>) => {
    selRef.current = s;
    setSelState(s);
  };
  const setEditing = (e: Editing | null) => {
    editingRef.current = e;
    setEditingState(e);
  };

  /* ---------------- drawing ---------------- */

  const paint = useCallback(() => {
    frame.current = 0;
    const c = canvas.current;
    const { w, h } = size.current;
    if (!c || !w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const d = docRef.current;
    const items = preview.current ?? moving.current?.items ?? d.items;
    let v = view.current;
    if (fit) {
      const b = inkBounds(items, { includeHighlighter: true });
      const ws = labelsRef.current?.length ? worksheetHeight(labelsRef.current.length, layoutRef.current) : 0;
      const k = Math.min(1, h / (Math.max(b?.maxY ?? 0, ws) + 10), w / ((b?.maxX ?? 0) + 10));
      v = { x: 0, y: 0, k };
    }
    ctx.translate(v.x, v.y);
    ctx.scale(v.k, v.k);
    if (labelsRef.current?.length)
      drawWorksheet(ctx, labelsRef.current, Math.max(w / v.k, layoutRef.current === "stacked" ? 300 : 420), { marks: marksRef.current, layout: layoutRef.current });
    else paperLines(ctx, d.paper, v, w, h);
    drawTemplate(ctx, d.template, w);
    const hidden = editingRef.current?.id ? new Set([editingRef.current.id]) : undefined;
    drawItems(ctx, items, { tint: opts.current.tint, marked: marked.current, hidden });
    if (live.current) drawItem(ctx, live.current, { tint: opts.current.tint, live: true });
    if (!opts.current.readOnly && (selRef.current.size || boxRect.current)) {
      const box = selRef.current.size ? selectionBox(items, selRef.current) : null;
      drawSelection(ctx, box, v.k, {
        rotate: !!box,
        guides: guides.current,
        rect: boxRect.current,
        view: { minX: -v.x / v.k, minY: -v.y / v.k, maxX: (w - v.x) / v.k, maxY: (h - v.y) / v.k },
      });
    }
  }, [fit]);

  const request = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  }, [paint]);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      size.current = { w: el.clientWidth, h: el.clientHeight };
      setPaperW(el.clientWidth);
      paint();
    });
    ro.observe(el);
    size.current = { w: el.clientWidth, h: el.clientHeight };
    paint();
    // Repaint once the handwriting font is ready (text boxes).
    void document.fonts?.ready.then(() => request());
    return () => ro.disconnect();
  }, [paint, request]);

  useEffect(request, [doc, tint, labels, marks, layout, sel, editing, request]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Leaving the select tool clears the selection; leaving the text tool finishes the text.
  useEffect(() => {
    if (tool?.tool !== "select" && selRef.current.size) setSel(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool?.tool]);

  /* ---------------- coordinates ---------------- */

  const toPaper = (clientX: number, clientY: number): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    const v = view.current;
    return [(clientX - r.left - v.x) / v.k, (clientY - r.top - v.y) / v.k];
  };

  const commit = (items: InkItem[]) => opts.current.onItems?.(items);

  const placeSymbol = useCallback((clientX: number, clientY: number, text: string) => {
    const [x, y] = toPaper(clientX, clientY);
    const t = opts.current.tool;
    commit([...docRef.current.items, { id: newId(), type: "symbol", text, x, y, size: 30, color: t?.color ?? PEN_COLORS[0]! }]);
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el || readOnly) return;
    paperDrops.set(el, placeSymbol);
    return () => void paperDrops.delete(el);
  }, [placeSymbol, readOnly]);

  /* ---------------- text editing ---------------- */

  const ctx2d = () => canvas.current?.getContext("2d") ?? null;

  /** Finish the text box: auto-format, measure, add / replace (undoable). Empty boxes are removed. */
  const finishText = useCallback(() => {
    const e = editingRef.current;
    if (!e) return;
    setEditing(null);
    const text = autoFormat(e.value, true).trim();
    const items = docRef.current.items;
    if (!text) {
      if (e.id) commit(items.filter((i) => i.id !== e.id));
      return;
    }
    const style = { text, size: e.size, bold: e.bold, font: e.font };
    const c = ctx2d();
    const { w, h } = c ? measureText(c, style) : { w: text.length * e.size * 0.55, h: e.size * LINE };
    const prev = e.id ? items.find((i) => i.id === e.id) : undefined;
    const item: InkText = { id: e.id ?? newId(), type: "text", x: e.x, y: e.y, color: e.color, w, h, ...style, ...(prev && "rot" in prev && prev.rot ? { rot: prev.rot } : {}) };
    if (prev && prev.type === "text" && prev.text === item.text && prev.size === item.size && prev.color === item.color && !!prev.bold === !!item.bold && prev.font === item.font) return;
    commit(prev ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item]);
  }, []);

  const startText = (x: number, y: number, existing?: InkText) => {
    finishText();
    const t = opts.current.tool;
    setSel(new Set());
    setEditing(
      existing
        ? { id: existing.id, x: existing.x, y: existing.y, value: existing.text, size: existing.size, color: existing.color, bold: !!existing.bold, font: existing.font ?? "hand" }
        : { id: null, x, y: y - TEXT_SIZES.M * 0.65, value: "", size: TEXT_SIZES.M, color: t?.color ?? PEN_COLORS[0]!, bold: false, font: "hand" },
    );
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  };

  // The symbol tray inserts at the text cursor while typing.
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      insert: (sym) => {
        const e = editingRef.current;
        const el = input.current;
        if (!e || !el) return false;
        const s = el.selectionStart ?? e.value.length;
        const en = el.selectionEnd ?? s;
        const value = e.value.slice(0, s) + sym + e.value.slice(en);
        setEditing({ ...e, value });
        requestAnimationFrame(() => {
          el.focus({ preventScroll: true });
          el.setSelectionRange(s + sym.length, s + sym.length);
        });
        return true;
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  /* ---------------- selection actions ---------------- */

  const act = useCallback((kind: "delete" | "duplicate" | "forward" | "back") => {
    const ids = selRef.current;
    if (!ids.size) return;
    const items = docRef.current.items;
    if (kind === "delete") {
      commit(deleteItems(items, ids));
      setSel(new Set());
    } else if (kind === "duplicate") {
      const d = duplicateItems(items, ids);
      commit(d.items);
      setSel(d.ids);
    } else commit(reorder(items, ids, kind === "forward" ? 1 : -1));
  }, []);

  /** Restyle the selected text box(es) (size / colour / bold / font), re-measured. */
  const restyle = (patch: Partial<Pick<InkText, "size" | "color" | "bold" | "font">>) => {
    const e = editingRef.current;
    if (e) {
      setEditing({ ...e, ...patch, bold: patch.bold ?? e.bold, font: patch.font ?? e.font });
      requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
      return;
    }
    const c = ctx2d();
    commit(
      docRef.current.items.map((it) => {
        if (!selRef.current.has(it.id)) return it;
        if (it.type === "text") {
          const next = { ...it, ...patch };
          return c ? { ...next, ...measureText(c, next) } : next;
        }
        if (patch.color && it.type !== "stroke") return { ...it, color: patch.color };
        if (patch.color && it.type === "stroke" && it.tool === "pen") return { ...it, color: patch.color };
        return it;
      }),
    );
  };

  // Keyboard: Delete / Backspace, Ctrl+D, Esc, arrows (only for this paper's selection).
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (!selRef.current.size || editingRef.current) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        act("delete");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        act("duplicate");
      } else if (e.key === "Escape") setSel(new Set());
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const st = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -st : e.key === "ArrowRight" ? st : 0;
        const dy = e.key === "ArrowUp" ? -st : e.key === "ArrowDown" ? st : 0;
        commit(moveItems(docRef.current.items, selRef.current, dx, dy));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, act]);

  /* ---------------- gestures ---------------- */

  const startGesture = (kind: Gesture["kind"]) => {
    const pts = [...pointers.current.values()];
    const mid: [number, number] = pts.length >= 2 ? [(pts[0]!.x + pts[1]!.x) / 2, (pts[0]!.y + pts[1]!.y) / 2] : [pts[0]!.x, pts[0]!.y];
    const dist = pts.length >= 2 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 1;
    gesture.current = { kind, mid, dist, view: { ...view.current } };
  };

  const updateGesture = () => {
    const g = gesture.current;
    if (!g || !zoomable) return;
    const pts = [...pointers.current.values()];
    const r = canvas.current!.getBoundingClientRect();
    const mid: [number, number] = pts.length >= 2 ? [(pts[0]!.x + pts[1]!.x) / 2, (pts[0]!.y + pts[1]!.y) / 2] : [pts[0]!.x, pts[0]!.y];
    let k = g.view.k;
    if (g.kind === "pinch" && pts.length >= 2) k = Math.min(4, Math.max(0.5, (g.view.k * Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y)) / g.dist));
    // keep the paper point that was under the fingers under the fingers
    const px = (g.mid[0] - r.left - g.view.x) / g.view.k;
    const py = (g.mid[1] - r.top - g.view.y) / g.view.k;
    view.current = { k, x: mid[0] - r.left - px * k, y: mid[1] - r.top - py * k };
    request();
  };

  const cancelLive = () => {
    live.current = null;
    marked.current = new Set();
    erasePath.current = [];
    moving.current = null;
    preview.current = null;
    drag.current = null;
    guides.current = [];
    boxRect.current = null;
    drawingId.current = null;
    clearTimeout(hold.current);
    clearTimeout(longPress.current);
  };

  /** Select tool: handles first, then items, then box-select on empty paper. */
  const startSelect = (x: number, y: number, additive: boolean) => {
    const items = docRef.current.items;
    const k = view.current.k;
    const box = selRef.current.size ? selectionBox(items, selRef.current) : null;
    if (box) {
      const [rx, ry] = rotateHandle(box, k);
      if (Math.hypot(x - rx, y - ry) < 14 / k) {
        const center: [number, number] = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
        drag.current = { mode: "rotate", orig: items, center, a0: Math.atan2(y - center[1], x - center[0]) };
        return;
      }
      const hs = selectionHandles(box, k);
      const hi = hs.findIndex(([hx, hy]) => Math.hypot(x - hx, y - hy) < 14 / k);
      if (hi >= 0) {
        const opp = hs[(hi + 2) % 4]!;
        drag.current = { mode: "resize", orig: items, box, anchor: opp };
        return;
      }
    }
    const hit = itemAt(items, x, y, 8 / k, hitItem);
    if (hit) {
      // double-tap a text box = edit it
      const now = performance.now();
      if (hit.type === "text" && lastTap.current?.id === hit.id && now - lastTap.current.t < 400) {
        lastTap.current = null;
        startText(hit.x, hit.y, hit);
        return;
      }
      lastTap.current = { id: hit.id, t: now };
      let next = selRef.current;
      if (additive) {
        next = new Set(next);
        if (next.has(hit.id)) next.delete(hit.id);
        else next.add(hit.id);
      } else if (!next.has(hit.id)) next = new Set([hit.id]);
      setSel(next);
      drag.current = { mode: "move", start: [x, y], orig: items, box: selectionBox(items, next) ?? itemBounds(hit) };
      return;
    }
    drag.current = { mode: "box", start: [x, y], additive, base: additive ? selRef.current : new Set() };
    boxRect.current = { minX: x, minY: y, maxX: x, maxY: y };
    if (!additive) setSel(new Set());
  };

  const lineTargets = () => {
    const n = labelsRef.current?.length ?? 0;
    const rh = rowHeight(layoutRef.current);
    return Array.from({ length: n }, (_, i) => ROW_TOP + (i + 1) * rh - 18);
  };

  const moveSelect = (x: number, y: number) => {
    const d = drag.current;
    if (!d) return;
    const ids = selRef.current;
    if (d.mode === "move") {
      const dx = x - d.start[0],
        dy = y - d.start[1];
      const others = d.orig.filter((it) => !ids.has(it.id)).map(itemBounds);
      const moved = { minX: d.box.minX + dx, minY: d.box.minY + dy, maxX: d.box.maxX + dx, maxY: d.box.maxY + dy };
      const s = snap(moved, others, lineTargets(), 6 / view.current.k);
      guides.current = s.guides;
      preview.current = moveItems(d.orig, ids, dx + s.dx, dy + s.dy);
    } else if (d.mode === "resize") {
      const [ax, ay] = d.anchor;
      const to = { minX: Math.min(ax, x), minY: Math.min(ay, y), maxX: Math.max(ax, x), maxY: Math.max(ay, y) };
      if (to.maxX - to.minX < 6 || to.maxY - to.minY < 6) return;
      // keep the original orientation (the anchor corner stays put)
      const from = d.box;
      preview.current = scaleItems(d.orig, ids, from, to);
    } else if (d.mode === "rotate") {
      let a = Math.atan2(y - d.center[1], x - d.center[0]) - d.a0;
      const step = Math.PI / 12; // snap to 15°
      if (Math.abs(a - Math.round(a / step) * step) < 0.06) a = Math.round(a / step) * step;
      preview.current = rotateItems(d.orig, ids, a, d.center);
    } else {
      boxRect.current = { minX: d.start[0], minY: d.start[1], maxX: x, maxY: y };
      const hits = boxSelect(docRef.current.items, boxRect.current);
      const next = new Set([...d.base, ...hits]);
      selRef.current = next;
    }
  };

  const endSelect = () => {
    const d = drag.current;
    if (d && d.mode !== "box" && preview.current) commit(preview.current);
    if (d?.mode === "box") setSel(new Set(selRef.current));
  };

  /* ---------------- pointer events ---------------- */

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const o = opts.current;
    if (o.readOnly || !o.tool) return;
    if (e.pointerType === "pen") o.onPen?.();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType });

    // Two fingers: pan / zoom, and forget any stroke the first finger started.
    if (pointers.current.size >= 2) {
      cancelLive();
      startGesture("pinch");
      request();
      return;
    }
    if ((o.penOnly && e.pointerType === "touch") || (e.pointerType === "mouse" && e.button === 1)) {
      startGesture("pan");
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (editingRef.current) {
      finishText();
      if (o.tool.tool === "text") return; // a click outside just finishes the text box
    }

    drawingId.current = e.pointerId;
    const [x, y] = toPaper(e.clientX, e.clientY);
    const t = o.tool;
    const items = docRef.current.items;
    snapped.current = false;

    if (t.tool === "select") {
      setBusy(true);
      startSelect(x, y, e.shiftKey || e.ctrlKey || e.metaKey);
      request();
      return;
    }
    if (t.tool === "text") {
      const hit = itemAt(items, x, y, 6 / view.current.k, hitItem);
      startText(x, y, hit?.type === "text" ? hit : undefined);
      drawingId.current = null;
      return;
    }

    // Long-press an item (finger / pen) = select it with the Select tool.
    if (e.pointerType !== "mouse") {
      clearTimeout(longPress.current);
      longPress.current = setTimeout(() => {
        const p = pointers.current.get(e.pointerId);
        if (!p || pointers.current.size !== 1 || Math.hypot(p.x - p.sx, p.y - p.sy) > 8) return;
        const hit = itemAt(docRef.current.items, x, y, 10 / view.current.k, hitItem);
        if (!hit) return;
        live.current = null;
        marked.current = new Set();
        opts.current.onToolChange?.("select");
        setSel(new Set([hit.id]));
        setBusy(true);
        drag.current = { mode: "move", start: toPaper(p.x, p.y), orig: docRef.current.items, box: itemBounds(hit) };
        try {
          navigator.vibrate?.(10);
        } catch {}
        request();
      }, 500);
    }

    if (t.tool === "pen" || t.tool === "highlighter") {
      const pressure = e.pointerType === "pen" && e.pressure > 0;
      live.current = {
        id: newId(),
        type: "stroke",
        tool: t.tool,
        color: t.tool === "highlighter" ? HIGHLIGHT : t.color,
        size: t.tool === "highlighter" ? 20 : PEN_SIZES[t.size]!,
        pressure,
        pts: [[round(x), round(y), pressure ? e.pressure : 0.5]],
      } satisfies InkStroke;
    } else if (t.tool === "eraser") {
      erasePath.current = [[x, y]];
      marked.current = new Set(itemsHit(items, [[x, y]], 8 / view.current.k));
    } else if (t.tool === "shape") {
      live.current = { id: newId(), type: "shape", shape: t.shape, x1: x, y1: y, x2: x, y2: y, color: t.color, size: PEN_SIZES[t.size]! };
    } else if (t.tool === "symbol") {
      const hit = [...items].reverse().find((it) => it.type === "symbol" && itemsHit([it], [[x, y]], 6).length);
      if (hit && hit.type === "symbol") moving.current = { id: hit.id, dx: x - hit.x, dy: y - hit.y, items };
      else {
        const sym: InkItem = { id: newId(), type: "symbol", text: t.symbol, x, y, size: 30, color: t.color };
        moving.current = { id: sym.id, dx: 0, dy: 0, items: [...items, sym] };
      }
    }
    request();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (gesture.current) return updateGesture();
    if (drawingId.current !== e.pointerId) return;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) clearTimeout(longPress.current);
    const t = opts.current.tool!;
    const events = (e.nativeEvent.getCoalescedEvents?.() ?? []) as PointerEvent[];
    const list = events.length ? events : [e.nativeEvent];

    if (drag.current) {
      const [x, y] = toPaper(e.clientX, e.clientY);
      moveSelect(x, y);
    } else if (live.current?.type === "stroke") {
      if (snapped.current) return;
      const s = live.current;
      for (const ev of list) {
        const [x, y] = toPaper(ev.clientX, ev.clientY);
        const last = s.pts[s.pts.length - 1]!;
        if (Math.hypot(x - last[0], y - last[1]) < 0.8 / view.current.k) continue;
        s.pts.push([round(x), round(y), s.pressure ? ev.pressure || 0.5 : 0.5]);
      }
      // Smart shapes: hold still for ½ s at the end of a rough circle/box.
      if (s.tool === "pen") {
        clearTimeout(hold.current);
        hold.current = setTimeout(() => {
          const cur = live.current;
          if (!cur || cur.type !== "stroke" || drawingId.current === null) return;
          const shape = recognizeShape(cur.pts);
          if (!shape) return;
          snapped.current = true;
          live.current = { id: cur.id, type: "shape", ...shape, color: cur.color, size: cur.size };
          try {
            navigator.vibrate?.(12);
          } catch {}
          request();
        }, 500);
      }
    } else if (live.current?.type === "shape") {
      const [x, y] = toPaper(e.clientX, e.clientY);
      live.current = { ...live.current, x2: x, y2: y };
    } else if (t.tool === "eraser") {
      for (const ev of list) erasePath.current.push(toPaper(ev.clientX, ev.clientY));
      const tail = erasePath.current.slice(-list.length - 1);
      for (const id of itemsHit(docRef.current.items, tail, 8 / view.current.k)) marked.current.add(id);
    } else if (moving.current) {
      const [x, y] = toPaper(e.clientX, e.clientY);
      const m = moving.current;
      m.items = m.items.map((it) => (it.id === m.id && it.type === "symbol" ? { ...it, x: x - m.dx, y: y - m.dy } : it));
    }
    request();
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    pointers.current.delete(e.pointerId);
    clearTimeout(longPress.current);
    if (gesture.current) {
      if (pointers.current.size === 0) {
        gesture.current = null;
        setVs({ ...view.current }); // move the floating bar with the paper
      } else if (pointers.current.size === 1 && gesture.current.kind === "pinch") startGesture("pan");
      return;
    }
    if (drawingId.current !== e.pointerId) return;
    clearTimeout(hold.current);
    const items = docRef.current.items;
    if (!cancelled) {
      const l = live.current;
      if (drag.current) endSelect();
      else if (l?.type === "stroke" && l.pts.length) commit([...items, l]);
      else if (l?.type === "shape" && Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 4) commit([...items, l]);
      else if (opts.current.tool?.tool === "eraser" && marked.current.size) {
        const gone = marked.current;
        commit(items.filter((it) => !gone.has(it.id)));
      } else if (moving.current) commit(moving.current.items);
    }
    cancelLive();
    setBusy(false);
    request();
  };

  // Ctrl + wheel (or a trackpad pinch) zooms. Native listener: React wheel listeners are passive.
  const onWheel = (e: WheelEvent) => {
    if (!zoomable || opts.current.readOnly || !e.ctrlKey || !canvas.current) return;
    e.preventDefault();
    const r = canvas.current!.getBoundingClientRect();
    const v = view.current;
    const k = Math.min(4, Math.max(0.5, v.k * Math.exp(-e.deltaY * 0.01)));
    const px = (e.clientX - r.left - v.x) / v.k;
    const py = (e.clientY - r.top - v.y) / v.k;
    view.current = { k, x: e.clientX - r.left - px * k, y: e.clientY - r.top - py * k };
    setVs({ ...view.current });
    request();
  };
  const wheelRef = useRef(onWheel);
  useLayoutEffect(() => {
    wheelRef.current = onWheel;
  });
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const h = (e: WheelEvent) => wheelRef.current(e);
    c.addEventListener("wheel", h, { passive: false });
    return () => c.removeEventListener("wheel", h);
  }, []);

  /* ---------------- floating bar + text input ---------------- */

  const v = vs;
  const selItems = doc.items.filter((it) => sel.has(it.id));
  const box = !readOnly && sel.size && !busy && !editing ? selectionBox(doc.items, sel) : null;
  const textSel = editing ?? (selItems.length && selItems.every((it) => it.type === "text") ? (selItems[0] as InkText) : null);
  // The bar sits above the selection, or below it when there is no room above (it never covers the item).
  const BAR_H = 46,
    BAR_W = Math.min(500, Math.max(0, paperW - 16));
  const target = editing
    ? { x: editing.x * v.k + v.x, top: editing.y * v.k + v.y, bottom: (editing.y + editing.size * LINE) * v.k + v.y }
    : box
      ? { x: ((box.minX + box.maxX) / 2) * v.k + v.x, top: box.minY * v.k + v.y - 34, bottom: box.maxY * v.k + v.y + 10 }
      : null;
  const barAt = target
    ? {
        x: Math.max(8, Math.min(Math.max(8, paperW - 8 - BAR_W), target.x - (editing ? 0 : BAR_W / 2))),
        y: target.top - BAR_H - 4 >= 4 ? target.top - BAR_H - 4 : target.bottom + 8,
      }
    : null;
  const curSize = editing?.size ?? (textSel && "size" in textSel ? textSel.size : TEXT_SIZES.M);
  const curColor = editing?.color ?? (selItems[0] && "color" in selItems[0] ? selItems[0].color : PEN_COLORS[0]);
  const curBold = editing ? editing.bold : !!(textSel && "bold" in textSel && textSel.bold);
  const curFont = editing ? editing.font : textSel && "font" in textSel && textSel.font === "sans" ? "sans" : "hand";

  const bar = barAt && (editing || box) && (
    <motion.div
      key="bar"
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 520, damping: 36 }}
      onPointerDown={(e) => e.preventDefault()} // keep the text cursor
      className="absolute z-20 flex max-w-[calc(100%-16px)] items-center gap-0.5 overflow-x-auto rounded-xl bg-surface p-1 shadow-[0_8px_24px_-12px_rgba(29,42,44,0.45)] ring-1 ring-line no-scrollbar"
      style={{
        left: barAt.x,
        top: barAt.y,
      }}
      role="toolbar"
      aria-label={editing ? "Text options" : "Selection options"}
    >
      {textSel && (
        <>
          {(Object.entries(TEXT_SIZES) as [keyof typeof TEXT_SIZES, number][]).map(([l, px]) => (
            <button key={l} type="button" aria-label={`Text size ${l}`} aria-pressed={curSize === px} onClick={() => restyle({ size: px })} className={barBtn(curSize === px)}>
              <span className="text-xs font-semibold">{l}</span>
            </button>
          ))}
          <button type="button" aria-label="Bold" aria-pressed={curBold} onClick={() => restyle({ bold: !curBold })} className={barBtn(curBold)}>
            <Bold className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={curFont === "hand" ? "Use the normal font" : "Use the handwriting font"}
            onClick={() => restyle({ font: curFont === "hand" ? "sans" : "hand" })}
            className={barBtn(false)}
            title="Handwriting / normal font"
          >
            <Type className="size-4" aria-hidden />
            <span className={`ml-0.5 text-[11px] ${curFont === "hand" ? "font-hand" : ""}`}>{curFont === "hand" ? "Aa" : "Aa"}</span>
          </button>
          <span className="mx-0.5 h-6 w-px shrink-0 bg-line" aria-hidden />
        </>
      )}
      {PEN_COLORS.map((c) => (
        <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={curColor === c} onClick={() => restyle({ color: c })} className="grid size-9 shrink-0 place-items-center">
          <span className={`size-5 rounded-full ${curColor === c ? "ring-2 ring-ink/50 ring-offset-1" : ""}`} style={{ background: c }} />
        </button>
      ))}
      {!editing && (
        <>
          <span className="mx-0.5 h-6 w-px shrink-0 bg-line" aria-hidden />
          <button type="button" aria-label="Duplicate (Ctrl+D)" title="Duplicate (Ctrl+D)" onClick={() => act("duplicate")} className={barBtn(false)}>
            <Copy className="size-4" aria-hidden />
          </button>
          <button type="button" aria-label="Bring forward" title="Bring forward" onClick={() => act("forward")} className={barBtn(false)}>
            <ArrowUpToLine className="size-4" aria-hidden />
          </button>
          <button type="button" aria-label="Send back" title="Send back" onClick={() => act("back")} className={barBtn(false)}>
            <ArrowDownToLine className="size-4" aria-hidden />
          </button>
          <button type="button" aria-label="Delete (Del)" title="Delete (Del)" onClick={() => act("delete")} className={`${barBtn(false)} text-bad`}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </>
      )}
      {editing && (
        <button type="button" aria-label="Done" onClick={finishText} className={`${barBtn(false)} text-good`}>
          <Check className="size-4" aria-hidden />
        </button>
      )}
    </motion.div>
  );

  return (
    <div ref={wrap} data-ink-paper={readOnly ? undefined : ""} className={`ink-paper relative overflow-hidden overscroll-contain ${className}`}>
      <canvas
        ref={canvas}
        aria-label={ariaLabel}
        role="img"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={(e) => onUp(e)}
        onPointerCancel={(e) => onUp(e, true)}
        onDoubleClick={(e) => {
          if (readOnly) return;
          const [x, y] = toPaper(e.clientX, e.clientY);
          const hit = itemAt(docRef.current.items, x, y, 6 / view.current.k, hitItem);
          if (hit?.type === "text") startText(hit.x, hit.y, hit);
        }}
        onContextMenu={(e) => !readOnly && e.preventDefault()}
        className={`absolute inset-0 size-full ${readOnly ? "pointer-events-none" : "touch-none"}`}
        style={{
          cursor: readOnly
            ? undefined
            : tool?.tool === "eraser"
              ? "cell"
              : tool?.tool === "symbol"
                ? "copy"
                : tool?.tool === "text"
                  ? "text"
                  : tool?.tool === "select"
                    ? "default"
                    : "crosshair",
        }}
      />

      {/* the text box being typed */}
      {editing && (
        <input
          ref={input}
          value={editing.value}
          aria-label="Text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setEditing({ ...editing, value: autoFormat(e.target.value) })}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") {
              e.preventDefault();
              finishText();
            }
          }}
          onBlur={() => finishText()}
          className="absolute z-10 rounded-md bg-accent/[0.06] px-0.5 outline-none ring-1 ring-accent/50"
          style={{
            left: editing.x * v.k + v.x - 2,
            top: editing.y * v.k + v.y - 2,
            font: textFont({ size: editing.size * v.k, bold: editing.bold, font: editing.font }),
            lineHeight: LINE,
            color: editing.color,
            width: `calc(${Math.max(3, [...editing.value].length + 1)}ch + 12px)`,
            minWidth: 48,
            maxWidth: paperW - 8,
          }}
        />
      )}
      <AnimatePresence>{bar}</AnimatePresence>
    </div>
  );
}

const barBtn = (active: boolean) =>
  `inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-1.5 transition-colors ${active ? "bg-accent text-white" : "text-ink hover:bg-ink/[0.06]"}`;

const round = (n: number) => Math.round(n * 10) / 10;

/** Lined / grid paper drawn on the canvas, so the lines move with pan and zoom. */
function paperLines(ctx: CanvasRenderingContext2D, paper: InkDoc["paper"], v: View, w: number, h: number) {
  if (paper === "blank") return;
  const x0 = -v.x / v.k,
    y0 = -v.y / v.k,
    x1 = x0 + w / v.k,
    y1 = y0 + h / v.k;
  ctx.save();
  ctx.lineWidth = 1 / v.k;
  if (paper === "lined") {
    ctx.strokeStyle = "rgba(61,106,145,0.2)";
    const step = 34;
    ctx.beginPath();
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      ctx.moveTo(x0, y + 0.5);
      ctx.lineTo(x1, y + 0.5);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(220,90,90,0.35)";
    ctx.beginPath();
    ctx.moveTo(36.5, y0);
    ctx.lineTo(36.5, y1);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(61,106,145,0.13)";
    const step = 22;
    ctx.beginPath();
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      ctx.moveTo(x + 0.5, y0);
      ctx.lineTo(x + 0.5, y1);
    }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      ctx.moveTo(x0, y + 0.5);
      ctx.lineTo(x1, y + 0.5);
    }
    ctx.stroke();
  }
  ctx.restore();
}
