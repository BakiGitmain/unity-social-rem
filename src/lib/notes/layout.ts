/**
 * "Tidy up": arranges the cards neatly. Connected cards become a tree from left to right (mind map style);
 * cards without connections go in a tidy grid below. Cards inside a frame move with their frame. Pure (tested).
 */
import type { BoardEdge, BoardNode } from "./types.ts";

const GAP_X = 80,
  GAP_Y = 36,
  GRID = 20;
const snap = (v: number) => Math.round(v / GRID) * GRID;

export function tidy(nodes: BoardNode[], edges: BoardEdge[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const free = nodes.filter((n) => !n.parent);
  const byId = new Map(free.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target || hasParent.has(e.target)) continue;
    children.set(e.source, [...(children.get(e.source) ?? []), e.target]); // each card gets one parent: a tree
    hasParent.add(e.target);
  }
  const connected = new Set([...children.keys(), ...hasParent]);
  const roots = free.filter((n) => connected.has(n.id) && !hasParent.has(n.id)).sort((a, b) => a.y - b.y || a.x - b.x);

  // column width per depth, so columns line up
  const colW: number[] = [];
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const height = (id: string, depth: number): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    colW[depth] = Math.max(colW[depth] ?? 0, byId.get(id)!.w);
    const kids = children.get(id) ?? [];
    const sum = kids.reduce((s, k) => s + height(k, depth + 1), 0) + Math.max(0, kids.length - 1) * GAP_Y;
    visiting.delete(id);
    const h = Math.max(byId.get(id)!.h, sum);
    memo.set(id, h);
    return h;
  };
  const place = (id: string, depth: number, top: number) => {
    if (pos.has(id)) return;
    const n = byId.get(id)!;
    const own = memo.get(id) ?? n.h;
    const x = colW.slice(0, depth).reduce((s, w) => s + w + GAP_X, 0);
    pos.set(id, { x: snap(x), y: snap(top + (own - n.h) / 2) });
    const kids = (children.get(id) ?? []).filter((k) => !pos.has(k));
    const total = kids.reduce((s, k) => s + (memo.get(k) ?? 0), 0) + Math.max(0, kids.length - 1) * GAP_Y;
    let y = top + (own - total) / 2;
    for (const k of kids) {
      place(k, depth + 1, y);
      y += (memo.get(k) ?? 0) + GAP_Y;
    }
  };

  let top = 0;
  for (const r of roots) {
    const h = height(r.id, 0);
    place(r.id, 0, top);
    top += h + GAP_Y * 2;
  }

  // everything else: a grid below (frames first, then cards), in reading order
  const rest = free
    .filter((n) => !pos.has(n.id))
    .sort((a, b) => (a.type === "frame" ? 0 : 1) - (b.type === "frame" ? 0 : 1) || a.y - b.y || a.x - b.x);
  const maxW = Math.max(1100, colW.reduce((s, w) => s + w + GAP_X, 0));
  let x = 0,
    rowH = 0;
  for (const n of rest) {
    if (x > 0 && x + n.w > maxW) {
      x = 0;
      top += rowH + GAP_Y;
      rowH = 0;
    }
    pos.set(n.id, { x: snap(x), y: snap(top) });
    x += n.w + GAP_X / 2;
    rowH = Math.max(rowH, n.h);
  }
  return pos;
}

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect, gap: number) =>
  a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

/**
 * An EMPTY spot for a new w×h card as close as possible to `near` (the point the card should be centred on):
 * it never overlaps another card or frame (keeps `gap` px around them). Searches rings of grid points outwards;
 * falls back to below everything. Returns the card's top-left corner, snapped to the grid. Pure (tested).
 */
export function freeSpot(nodes: Rect[], w: number, h: number, near: { x: number; y: number }, gap = 24): { x: number; y: number } {
  const x0 = snap(near.x - w / 2),
    y0 = snap(near.y - h / 2);
  const fits = (x: number, y: number) => !nodes.some((n) => overlaps({ x, y, w, h }, n, gap));
  if (fits(x0, y0)) return { x: x0, y: y0 };
  const STEP = 40;
  for (let r = 1; r <= 60; r++) {
    // every grid point on the square ring at distance r, nearest first
    const ring: [number, number][] = [];
    for (let i = -r; i <= r; i++) ring.push([i, -r], [i, r], ...(Math.abs(i) < r ? ([[-r, i], [r, i]] as [number, number][]) : []));
    ring.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));
    for (const [i, j] of ring) {
      const x = x0 + i * STEP,
        y = y0 + j * STEP;
      if (fits(x, y)) return { x, y };
    }
  }
  const bottom = nodes.reduce((m, n) => Math.max(m, n.y + n.h), 0);
  const left = nodes.reduce((m, n) => Math.min(m, n.x), Infinity);
  return { x: snap(Number.isFinite(left) ? left : 0), y: snap(bottom + gap * 2) };
}

/** The box around all cards (null when there are none). */
export function boundsOf(nodes: Rect[]): Rect | null {
  if (!nodes.length) return null;
  const x = Math.min(...nodes.map((n) => n.x)),
    y = Math.min(...nodes.map((n) => n.y));
  return { x, y, w: Math.max(...nodes.map((n) => n.x + n.w)) - x, h: Math.max(...nodes.map((n) => n.y + n.h)) - y };
}
