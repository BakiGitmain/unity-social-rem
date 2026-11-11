/**
 * Select / Move tool logic, pure (tested in ink.test.ts): move, resize, rotate, duplicate, reorder,
 * box-select and snap guides.
 */
import { baseBounds, itemBounds, itemCenter, newId, type Box, type InkItem } from "./model.ts";

export const unionBox = (boxes: Box[]): Box | null =>
  boxes.length
    ? {
        minX: Math.min(...boxes.map((b) => b.minX)),
        minY: Math.min(...boxes.map((b) => b.minY)),
        maxX: Math.max(...boxes.map((b) => b.maxX)),
        maxY: Math.max(...boxes.map((b) => b.maxY)),
      }
    : null;

export const selectionBox = (items: InkItem[], ids: Set<string>) => unionBox(items.filter((it) => ids.has(it.id)).map(itemBounds));

/** Move one item by (dx, dy). */
export function translateItem(it: InkItem, dx: number, dy: number): InkItem {
  if (it.type === "stroke") return { ...it, pts: it.pts.map(([x, y, p]) => [x + dx, y + dy, p]) };
  if (it.type === "shape") return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy };
  return { ...it, x: it.x + dx, y: it.y + dy };
}

export const moveItems = (items: InkItem[], ids: Set<string>, dx: number, dy: number) =>
  items.map((it) => (ids.has(it.id) ? translateItem(it, dx, dy) : it));

/**
 * Resize the selection from box `from` to box `to` (corner drag). Points and positions scale with the box;
 * symbol and text sizes scale with the average factor so they stay readable.
 */
export function scaleItems(items: InkItem[], ids: Set<string>, from: Box, to: Box): InkItem[] {
  const fw = Math.max(1, from.maxX - from.minX),
    fh = Math.max(1, from.maxY - from.minY);
  const sx = (to.maxX - to.minX) / fw,
    sy = (to.maxY - to.minY) / fh;
  const mx = (x: number) => to.minX + (x - from.minX) * sx;
  const my = (y: number) => to.minY + (y - from.minY) * sy;
  const k = Math.max(0.2, (Math.abs(sx) + Math.abs(sy)) / 2);
  return items.map((it) => {
    if (!ids.has(it.id)) return it;
    if (it.type === "stroke") return { ...it, pts: it.pts.map(([x, y, p]) => [mx(x), my(y), p]) };
    if (it.type === "shape") return { ...it, x1: mx(it.x1), y1: my(it.y1), x2: mx(it.x2), y2: my(it.y2) };
    if (it.type === "symbol") return { ...it, x: mx(it.x), y: my(it.y), size: Math.max(8, it.size * k) };
    return { ...it, x: mx(it.x), y: my(it.y), size: Math.max(8, it.size * k), w: it.w * k, h: it.h * k };
  });
}

/** Rotate items around the centre of the selection. Strokes / lines bake the rotation into their points. */
export function rotateItems(items: InkItem[], ids: Set<string>, angle: number, pivot?: [number, number]): InkItem[] {
  const box = selectionBox(items, ids);
  if (!box) return items;
  const [cx, cy] = pivot ?? [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rot = (x: number, y: number): [number, number] => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
  return items.map((it) => {
    if (!ids.has(it.id)) return it;
    if (it.type === "stroke") return { ...it, pts: it.pts.map(([x, y, p]) => [...rot(x, y), p]) };
    if (it.type === "shape" && (it.shape === "line" || it.shape === "arrow")) {
      const [x1, y1] = rot(it.x1, it.y1);
      const [x2, y2] = rot(it.x2, it.y2);
      return { ...it, x1, y1, x2, y2 };
    }
    // rect / ellipse / symbol / text: move the centre, add to the rotation
    const [ox, oy] = itemCenter(it);
    const [nx, ny] = rot(ox, oy);
    const moved = translateItem(it, nx - ox, ny - oy);
    return { ...moved, rot: (("rot" in it && it.rot) || 0) + angle } as InkItem;
  });
}

/** Copies of the selected items, slightly offset, appended on top. Returns the new items and their ids. */
export function duplicateItems(items: InkItem[], ids: Set<string>, offset = 16): { items: InkItem[]; ids: Set<string> } {
  const copies = items.filter((it) => ids.has(it.id)).map((it) => ({ ...translateItem(it, offset, offset), id: newId() }) as InkItem);
  return { items: [...items, ...copies], ids: new Set(copies.map((c) => c.id)) };
}

export const deleteItems = (items: InkItem[], ids: Set<string>) => items.filter((it) => !ids.has(it.id));

/** Bring forward (+1) or send back (-1) one step, keeping the selection's order. */
export function reorder(items: InkItem[], ids: Set<string>, dir: 1 | -1): InkItem[] {
  const a = [...items];
  const idx = a.map((it, i) => (ids.has(it.id) ? i : -1)).filter((i) => i >= 0);
  const order = dir === 1 ? idx.reverse() : idx;
  for (const i of order) {
    const j = i + dir;
    if (j < 0 || j >= a.length || ids.has(a[j]!.id)) continue;
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Box (lasso) select: every item whose bounds touch the rectangle. */
export function boxSelect(items: InkItem[], r: Box): Set<string> {
  const x1 = Math.min(r.minX, r.maxX),
    x2 = Math.max(r.minX, r.maxX),
    y1 = Math.min(r.minY, r.maxY),
    y2 = Math.max(r.minY, r.maxY);
  return new Set(
    items
      .filter((it) => {
        const b = itemBounds(it);
        return b.maxX >= x1 && b.minX <= x2 && b.maxY >= y1 && b.minY <= y2;
      })
      .map((it) => it.id),
  );
}

/** Topmost item at a point (for tap-to-select). */
export function itemAt(items: InkItem[], x: number, y: number, r: number, hit: (it: InkItem, x: number, y: number, r: number) => boolean): InkItem | null {
  for (let i = items.length - 1; i >= 0; i--) if (hit(items[i]!, x, y, r)) return items[i]!;
  return null;
}

export type Guide = { axis: "x" | "y"; at: number };

/**
 * Snap a moving box to other items' edges / centres and to extra horizontal lines (the Answer Paper's
 * labelled lines). Returns the correction to add to the move and the guides to draw.
 */
export function snap(moving: Box, others: Box[], lines: number[] = [], threshold = 6): { dx: number; dy: number; guides: Guide[] } {
  const xs = (b: Box) => [b.minX, (b.minX + b.maxX) / 2, b.maxX];
  const ys = (b: Box) => [b.minY, (b.minY + b.maxY) / 2, b.maxY];
  let best = { dx: 0, ax: Infinity, gx: NaN, dy: 0, ay: Infinity, gy: NaN };
  const tx = others.flatMap(xs);
  const ty = [...others.flatMap(ys), ...lines];
  for (const m of xs(moving))
    for (const t of tx) {
      const d = t - m;
      if (Math.abs(d) <= threshold && Math.abs(d) < best.ax) best = { ...best, dx: d, ax: Math.abs(d), gx: t };
    }
  for (const m of ys(moving))
    for (const t of ty) {
      const d = t - m;
      if (Math.abs(d) <= threshold && Math.abs(d) < best.ay) best = { ...best, dy: d, ay: Math.abs(d), gy: t };
    }
  const guides: Guide[] = [];
  if (Number.isFinite(best.ax)) guides.push({ axis: "x", at: best.gx });
  if (Number.isFinite(best.ay)) guides.push({ axis: "y", at: best.gy });
  return { dx: Number.isFinite(best.ax) ? best.dx : 0, dy: Number.isFinite(best.ay) ? best.dy : 0, guides };
}

export { baseBounds };
