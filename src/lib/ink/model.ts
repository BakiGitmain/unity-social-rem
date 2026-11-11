/**
 * Answer Paper ink, stored as VECTOR data (points), never bitmaps. Pure functions only (tested in ink.test.ts):
 * bounds, crop/downscale plan for the AI, a stable hash for caching, hit-testing (eraser) and smart shapes.
 */

/** x, y (paper px at zoom 1) and pressure 0–1. */
export type Pt = [number, number, number];
export type PenTool = "pen" | "highlighter";
export type ShapeKind = "line" | "arrow" | "rect" | "ellipse";

export type InkStroke = { id: string; type: "stroke"; tool: PenTool; color: string; size: number; pts: Pt[]; pressure?: boolean };
/** `rot` = rotation in radians around the item's centre (shapes, symbols, text). */
export type InkShape = { id: string; type: "shape"; shape: ShapeKind; x1: number; y1: number; x2: number; y2: number; color: string; size: number; rot?: number };
export type InkSymbol = { id: string; type: "symbol"; text: string; x: number; y: number; size: number; color: string; rot?: number };
/** Typed text box: (x, y) = top-left; w / h measured when it was written (font px = size). */
export type InkText = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  color: string;
  bold?: boolean;
  font?: "hand" | "sans";
  rot?: number;
};
export type InkItem = InkStroke | InkShape | InkSymbol | InkText;

export type Paper = "lined" | "grid" | "blank";
export type Template = "none" | "venn2" | "venn3";
export type InkDoc = { items: InkItem[]; paper: Paper; template: Template };

export const EMPTY_DOC: InkDoc = { items: [], paper: "lined", template: "none" };

export type Box = { minX: number; minY: number; maxX: number; maxY: number };

let seq = 0;
export const newId = () => `${Date.now().toString(36)}${(seq++ % 1296).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* ------------------------------------------------------------------ bounds */

/** Centre of an item (rotation pivot). */
export function itemCenter(it: InkItem): [number, number] {
  const b = baseBounds(it);
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
}

const rotate = (x: number, y: number, cx: number, cy: number, a: number): [number, number] => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
};

/** Bounds including rotation. */
export function itemBounds(it: InkItem): Box {
  const b = baseBounds(it);
  const rot = "rot" in it ? it.rot : 0;
  if (!rot) return b;
  const cx = (b.minX + b.maxX) / 2,
    cy = (b.minY + b.maxY) / 2;
  const pts = [
    rotate(b.minX, b.minY, cx, cy, rot),
    rotate(b.maxX, b.minY, cx, cy, rot),
    rotate(b.maxX, b.maxY, cx, cy, rot),
    rotate(b.minX, b.maxY, cx, cy, rot),
  ];
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxX: Math.max(...pts.map((p) => p[0])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

/** Bounds without rotation. */
export function baseBounds(it: InkItem): Box {
  if (it.type === "text") return { minX: it.x, minY: it.y, maxX: it.x + Math.max(it.w, 8), maxY: it.y + Math.max(it.h, it.size) };
  if (it.type === "stroke") {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of it.pts) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const r = it.size / 2 + 1;
    return { minX: minX - r, minY: minY - r, maxX: maxX + r, maxY: maxY + r };
  }
  if (it.type === "shape") {
    const r = it.size / 2 + (it.shape === "arrow" ? 10 : 1);
    return { minX: Math.min(it.x1, it.x2) - r, minY: Math.min(it.y1, it.y2) - r, maxX: Math.max(it.x1, it.x2) + r, maxY: Math.max(it.y1, it.y2) + r };
  }
  // symbols are drawn centred on (x, y)
  const w = it.size * 0.6 * Math.max(1, [...it.text].length);
  return { minX: it.x - w / 2, minY: it.y - it.size * 0.6, maxX: it.x + w / 2, maxY: it.y + it.size * 0.6 };
}

/** Bounding box of all ink (highlighter excluded: it is not part of the answer). null = no ink. */
export function inkBounds(items: InkItem[], { includeHighlighter = false } = {}): Box | null {
  let b: Box | null = null;
  for (const it of items) {
    if (it.type === "stroke" && it.tool === "highlighter" && !includeHighlighter) continue;
    const ib = itemBounds(it);
    b = b
      ? { minX: Math.min(b.minX, ib.minX), minY: Math.min(b.minY, ib.minY), maxX: Math.max(b.maxX, ib.maxX), maxY: Math.max(b.maxY, ib.maxY) }
      : ib;
  }
  return b;
}

export type CropPlan = { sx: number; sy: number; sw: number; sh: number; scale: number; outW: number; outH: number };

/**
 * Crop to the ink (+ padding) and scale so the longest side is at most `max` px (small writing is enlarged
 * up to 2× so it stays readable). The output image is outW × outH.
 */
export function cropPlan(b: Box, pad = 16, max = 512): CropPlan {
  const sx = Math.floor(b.minX - pad);
  const sy = Math.floor(b.minY - pad);
  const sw = Math.max(1, Math.ceil(b.maxX + pad) - sx);
  const sh = Math.max(1, Math.ceil(b.maxY + pad) - sy);
  const scale = Math.min(2, max / Math.max(sw, sh));
  return { sx, sy, sw, sh, scale, outW: Math.max(1, Math.round(sw * scale)), outH: Math.max(1, Math.round(sh * scale)) };
}

/* ------------------------------------------------------------------ hash (cache key) */

/** Stable hash of the ink (rounded coordinates): the same ink → the same key → no second AI call. */
export function hashInk(items: InkItem[], extra = ""): string {
  let h1 = 0x811c9dc5,
    h2 = 0x01000193;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 ^ c, 2246822519);
    }
  };
  feed(extra);
  for (const it of items) {
    if (it.type === "stroke") {
      if (it.tool === "highlighter") continue;
      feed("s");
      for (const [x, y] of it.pts) feed(`${Math.round(x)},${Math.round(y)};`);
    } else if (it.type === "shape") feed(`h${it.shape}${Math.round(it.x1)},${Math.round(it.y1)},${Math.round(it.x2)},${Math.round(it.y2)}`);
    else if (it.type === "text") feed(`t${it.text}${Math.round(it.x)},${Math.round(it.y)}`);
    else feed(`y${it.text}${Math.round(it.x)},${Math.round(it.y)}`);
  }
  return ((h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0"));
}

/* ------------------------------------------------------------------ hit testing (eraser) */

export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax,
    dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Is (x, y) within r of the item? */
export function hitItem(it: InkItem, x: number, y: number, r: number): boolean {
  const b = itemBounds(it);
  if (x < b.minX - r || x > b.maxX + r || y < b.minY - r || y > b.maxY + r) return false;
  if (it.type === "symbol" || it.type === "text") return true;
  if (it.type === "shape" && it.rot) {
    // test in the shape's own (unrotated) frame
    const [cx, cy] = itemCenter(it);
    [x, y] = rotate(x, y, cx, cy, -it.rot);
  }
  const rr = r + it.size / 2;
  if (it.type === "stroke") {
    const p = it.pts;
    if (p.length === 1) return Math.hypot(x - p[0]![0], y - p[0]![1]) <= rr;
    for (let i = 1; i < p.length; i++) if (distToSegment(x, y, p[i - 1]![0], p[i - 1]![1], p[i]![0], p[i]![1]) <= rr) return true;
    return false;
  }
  const { x1, y1, x2, y2 } = it;
  if (it.shape === "line" || it.shape === "arrow") return distToSegment(x, y, x1, y1, x2, y2) <= rr;
  if (it.shape === "rect") {
    return (
      distToSegment(x, y, x1, y1, x2, y1) <= rr ||
      distToSegment(x, y, x2, y1, x2, y2) <= rr ||
      distToSegment(x, y, x2, y2, x1, y2) <= rr ||
      distToSegment(x, y, x1, y2, x1, y1) <= rr
    );
  }
  const cx = (x1 + x2) / 2,
    cy = (y1 + y2) / 2,
    rx = Math.abs(x2 - x1) / 2 || 1,
    ry = Math.abs(y2 - y1) / 2 || 1;
  const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
  return Math.abs(d - 1) * Math.min(rx, ry) <= rr;
}

/** Items touched by an eraser path (tap = one point, scribble = many). */
export function itemsHit(items: InkItem[], path: [number, number][], r: number): string[] {
  const out: string[] = [];
  for (const it of items) if (path.some(([x, y]) => hitItem(it, x, y, r))) out.push(it.id);
  return out;
}

/* ------------------------------------------------------------------ smart shapes */

/**
 * "Draw a rough circle or rectangle and hold": returns the perfect shape, or null if the stroke is neither.
 * The path must be closed (end near the start) and big enough.
 */
export function recognizeShape(pts: Pt[]): { shape: "ellipse" | "rect"; x1: number; y1: number; x2: number; y2: number } | null {
  if (pts.length < 12) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const w = maxX - minX,
    h = maxY - minY;
  const diag = Math.hypot(w, h);
  if (w < 24 || h < 24) return null;
  const [sx, sy] = pts[0]!;
  const [ex, ey] = pts[pts.length - 1]!;
  if (Math.hypot(ex - sx, ey - sy) > diag * 0.3) return null; // not closed

  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2,
    rx = w / 2,
    ry = h / 2;
  let ell = 0,
    rect = 0;
  const corners = [0, 0, 0, 0];
  for (const [x, y] of pts) {
    ell += Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1);
    const de = Math.min(x - minX, maxX - x, y - minY, maxY - y);
    rect += de / Math.min(w, h);
    const nearX = Math.min(x - minX, maxX - x) < w * 0.15;
    const nearY = Math.min(y - minY, maxY - y) < h * 0.15;
    if (nearX && nearY) corners[(x < cx ? 0 : 1) + (y < cy ? 0 : 2)] = 1;
  }
  ell /= pts.length;
  rect /= pts.length;
  const box = { x1: minX, y1: minY, x2: maxX, y2: maxY };
  const isRect = rect < 0.06 && corners.every(Boolean);
  if (isRect && (ell > 0.09 || rect < ell * 0.6)) return { shape: "rect", ...box };
  if (ell < 0.16) return { shape: "ellipse", ...box };
  if (isRect) return { shape: "rect", ...box };
  return null;
}

/* ------------------------------------------------------------------ worksheet (labelled lines) */

/**
 * Worksheet geometry: one answer line per labelled part. "side" (desktop): "A ∪ B = ____" with the label on
 * the left. "stacked" (phones): the label is printed ABOVE a full-width writing line, so the whole width is for writing.
 */
export type WsLayout = "side" | "stacked";
export const ROW_TOP = 12;
export const rowHeight = (layout: WsLayout = "side") => (layout === "stacked" ? 96 : 72);
export const ROW_H = rowHeight("side");
export const labelWidth = (labels: string[]) => Math.min(220, 28 + Math.max(0, ...labels.map((l) => [...l].length)) * 13 + 30);
/** Index of the line a y coordinate falls on (clamped). */
export const rowAt = (y: number, rows: number, layout: WsLayout = "side") =>
  Math.max(0, Math.min(rows - 1, Math.floor((y - ROW_TOP) / rowHeight(layout))));
export const worksheetHeight = (rows: number, layout: WsLayout = "side") => ROW_TOP + rows * rowHeight(layout) + 12;

/** Crop for a worksheet: always includes the printed labels (the AI must see which line is which). */
export function worksheetBox(items: InkItem[], labels: string[], layout: WsLayout = "side"): Box {
  const ink = inkBounds(items);
  const bottom = ROW_TOP + labels.length * rowHeight(layout);
  return { minX: 0, minY: 0, maxX: Math.max(layout === "stacked" ? 320 : 420, ink?.maxX ?? 0), maxY: Math.max(bottom, ink?.maxY ?? 0) };
}
