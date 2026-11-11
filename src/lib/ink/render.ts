/**
 * Draw Answer Paper ink on a 2D canvas (screen and the AI export use the same code).
 * Pen strokes use perfect-freehand (pressure from a stylus, simulated for mouse/finger).
 */
import { getStroke } from "perfect-freehand";
import { baseBounds, itemCenter, cropPlan, inkBounds, type Box, type InkText, labelWidth, rowHeight, ROW_TOP, worksheetBox, type CropPlan, type InkItem, type InkStroke, type Template, type WsLayout } from "./model.ts";

/** Outline polygon of a pen stroke (perfect-freehand). */
export function strokeOutline(s: Pick<InkStroke, "pts" | "size" | "pressure">, last = true): number[][] {
  return getStroke(s.pts, {
    size: s.size,
    thinning: s.pressure ? 0.6 : 0.5,
    smoothing: 0.55,
    streamline: 0.45,
    simulatePressure: !s.pressure,
    last,
  });
}

/** Smooth closed path through the outline points (quadratic curves between midpoints). */
function outlinePath(pts: number[][]): Path2D {
  const p = new Path2D();
  if (pts.length < 2) return p;
  p.moveTo(pts[0]![0]!, pts[0]![1]!);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    p.quadraticCurveTo(a[0]!, a[1]!, (a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2);
  }
  p.closePath();
  return p;
}

export type DrawOpts = {
  /** Override every ink colour (green when correct; black for the AI export). */
  tint?: string | null;
  /** Items the eraser is about to remove (drawn red). */
  marked?: Set<string>;
  /** The AI export: no highlighter. */
  exportMode?: boolean;
  /** Items not drawn (the text box being edited is shown as a live input instead). */
  hidden?: Set<string>;
  live?: boolean;
};

/* ------------------------------------------------------------------ text */

let handFamily = "";
/** The handwriting font (Kalam, from next/font) or the normal UI font, as a canvas font family. */
export function fontFamily(font: InkText["font"]): string {
  if (typeof document === "undefined") return "sans-serif";
  const css = getComputedStyle(document.documentElement);
  if (font === "sans") return `${css.getPropertyValue("--font-lexend").trim() || "system-ui"}, "Segoe UI Symbol", sans-serif`;
  if (!handFamily) handFamily = css.getPropertyValue("--font-hand").trim();
  return `${handFamily || "cursive"}, "Segoe UI Symbol", sans-serif`;
}
export const textFont = (t: Pick<InkText, "size" | "bold" | "font">) => `${t.bold ? 700 : 400} ${t.size}px ${fontFamily(t.font)}`;
export const LINE = 1.3;

/** Measure a text box (w / h are stored with the item). */
export function measureText(ctx: CanvasRenderingContext2D, t: Pick<InkText, "text" | "size" | "bold" | "font">): { w: number; h: number } {
  ctx.save();
  ctx.font = textFont(t);
  const lines = t.text.split("\n");
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width), t.size * 0.4);
  ctx.restore();
  return { w: Math.ceil(w) + 2, h: Math.ceil(lines.length * t.size * LINE) };
}

export function drawItem(ctx: CanvasRenderingContext2D, it: InkItem, o: DrawOpts = {}) {
  const color = o.marked?.has(it.id) ? "#dc2626" : (o.tint ?? it.color);
  ctx.save();
  if (o.marked?.has(it.id)) ctx.globalAlpha = 0.55;
  if (o.hidden?.has(it.id)) return ctx.restore();
  // rotation around the item's centre (shapes, symbols, text)
  const rot = "rot" in it ? it.rot : 0;
  if (rot) {
    const [cx, cy] = itemCenter(it);
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);
  }
  if (it.type === "text") {
    ctx.fillStyle = color;
    ctx.font = textFont(it);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    it.text.split("\n").forEach((line, i) => ctx.fillText(line, it.x, it.y + i * it.size * LINE + it.size * 0.08));
    return ctx.restore();
  }
  if (it.type === "stroke") {
    if (it.tool === "highlighter") {
      if (o.exportMode) return ctx.restore();
      ctx.globalAlpha = 0.32;
      ctx.globalCompositeOperation = "multiply";
      ctx.strokeStyle = o.marked?.has(it.id) ? "#dc2626" : it.color;
      ctx.lineWidth = it.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      it.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (it.pts.length === 1) ctx.lineTo(it.pts[0]![0] + 0.01, it.pts[0]![1]);
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill(outlinePath(strokeOutline(it, !o.live)));
    }
  } else if (it.type === "shape") {
    ctx.strokeStyle = color;
    ctx.lineWidth = it.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const { x1, y1, x2, y2 } = it;
    ctx.beginPath();
    if (it.shape === "rect") ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    else if (it.shape === "ellipse") ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2 || 0.5, Math.abs(y2 - y1) / 2 || 0.5, 0, 0, Math.PI * 2);
    else {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      if (it.shape === "arrow") {
        const a = Math.atan2(y2 - y1, x2 - x1);
        const h = 10 + it.size * 2;
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - h * Math.cos(a - 0.45), y2 - h * Math.sin(a - 0.45));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - h * Math.cos(a + 0.45), y2 - h * Math.sin(a + 0.45));
      }
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.font = `600 ${it.size}px "Cambria Math", "STIX Two Math", "Segoe UI Symbol", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(it.text, it.x, it.y);
  }
  ctx.restore();
}

/** 2-set / 3-set Venn template (U box + labels) in paper coordinates, for diagram questions. */
export function drawTemplate(ctx: CanvasRenderingContext2D, t: Template, width: number) {
  if (t === "none") return;
  const w = Math.min(width - 40, 420);
  const x0 = (width - w) / 2;
  const s = w / 320;
  ctx.save();
  ctx.translate(x0, 16);
  ctx.scale(s, s);
  ctx.strokeStyle = "#8b9698";
  ctx.fillStyle = "#5c6a6d";
  ctx.lineWidth = 1.6 / s;
  ctx.setLineDash([6, 5]);
  ctx.strokeRect(4, 4, 312, t === "venn3" ? 292 : 222);
  ctx.setLineDash([]);
  ctx.font = "italic 15px serif";
  ctx.fillText("U", 14, 24);
  ctx.font = "bold 16px sans-serif";
  const circle = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  if (t === "venn2") {
    circle(122, 116, 74);
    circle(198, 116, 74);
    ctx.fillText("A", 56, 46);
    ctx.fillText("B", 252, 46);
  } else {
    circle(125, 112, 70);
    circle(195, 112, 70);
    circle(160, 176, 70);
    ctx.fillText("A", 52, 50);
    ctx.fillText("B", 258, 50);
    ctx.fillText("C", 154, 280);
  }
  ctx.restore();
}

/** The printed worksheet: "label =" on the left of each answer line, with a writing line. */
export function drawWorksheet(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  width: number,
  opts: { ink?: string; marks?: (boolean | null)[]; layout?: WsLayout } = {},
) {
  const stacked = opts.layout === "stacked";
  const rh = rowHeight(opts.layout);
  const lw = stacked ? 14 : labelWidth(labels);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  labels.forEach((label, i) => {
    const base = ROW_TOP + (i + 1) * rh - 18;
    if (stacked && i % 2 === 1) {
      ctx.fillStyle = "rgba(61,106,145,0.035)";
      ctx.fillRect(0, ROW_TOP + i * rh, width, rh);
    }
    ctx.strokeStyle = "rgba(61,106,145,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lw, base + 0.5);
    ctx.lineTo(width - 12, base + 0.5);
    ctx.stroke();
    ctx.fillStyle = opts.ink ?? "#3d4b4e";
    ctx.font = `600 ${stacked ? 16 : 20}px "Cambria Math", "STIX Two Math", "Segoe UI Symbol", serif`;
    ctx.textAlign = stacked ? "left" : "right";
    if (stacked) ctx.fillText(`${label} =`, 28, ROW_TOP + i * rh + 22);
    else ctx.fillText(`${label} =`, lw - 10, base - 4);
    const m = opts.marks?.[i];
    if (m !== undefined && m !== null) {
      ctx.fillStyle = m ? "#15803d" : "#dc2626";
      ctx.font = "700 20px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(m ? "✓" : "✗", stacked ? 6 : 8, stacked ? ROW_TOP + i * rh + 22 : base - 4);
    }
  });
  ctx.restore();
}

/** Selection: soft outline, corner handles and (for one item) a rotate handle; snap guides; box-select rect. */
export function drawSelection(
  ctx: CanvasRenderingContext2D,
  box: Box | null,
  k: number,
  o: { rotate?: boolean; guides?: { axis: "x" | "y"; at: number }[]; rect?: Box | null; view?: Box } = {},
) {
  ctx.save();
  const accent = "#0f766e";
  if (box) {
    const pad = 6 / k;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5 / k;
    ctx.setLineDash([5 / k, 4 / k]);
    ctx.strokeRect(box.minX - pad, box.minY - pad, box.maxX - box.minX + 2 * pad, box.maxY - box.minY + 2 * pad);
    ctx.setLineDash([]);
    const hs = 9 / k;
    ctx.fillStyle = "#fff";
    for (const [x, y] of selectionHandles(box, k)) {
      ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs);
      ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs);
    }
    if (o.rotate) {
      const [rx, ry] = rotateHandle(box, k);
      ctx.beginPath();
      ctx.moveTo((box.minX + box.maxX) / 2, box.minY - pad);
      ctx.lineTo(rx, ry);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rx, ry, 6 / k, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (o.rect) {
    ctx.fillStyle = "rgba(15,118,110,0.08)";
    ctx.strokeStyle = "rgba(15,118,110,0.6)";
    ctx.lineWidth = 1 / k;
    const r = o.rect;
    ctx.fillRect(Math.min(r.minX, r.maxX), Math.min(r.minY, r.maxY), Math.abs(r.maxX - r.minX), Math.abs(r.maxY - r.minY));
    ctx.strokeRect(Math.min(r.minX, r.maxX), Math.min(r.minY, r.maxY), Math.abs(r.maxX - r.minX), Math.abs(r.maxY - r.minY));
  }
  if (o.guides?.length && o.view) {
    ctx.strokeStyle = "#e11d48";
    ctx.lineWidth = 1 / k;
    for (const g of o.guides) {
      ctx.beginPath();
      if (g.axis === "x") {
        ctx.moveTo(g.at, o.view.minY);
        ctx.lineTo(g.at, o.view.maxY);
      } else {
        ctx.moveTo(o.view.minX, g.at);
        ctx.lineTo(o.view.maxX, g.at);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Corner handles: [x, y] in paper coordinates (order: top-left, top-right, bottom-right, bottom-left). */
export function selectionHandles(box: Box, k: number): [number, number][] {
  const pad = 6 / k;
  return [
    [box.minX - pad, box.minY - pad],
    [box.maxX + pad, box.minY - pad],
    [box.maxX + pad, box.maxY + pad],
    [box.minX - pad, box.maxY + pad],
  ];
}
export const rotateHandle = (box: Box, k: number): [number, number] => [(box.minX + box.maxX) / 2, box.minY - 6 / k - 26 / k];

export { baseBounds };

export function drawItems(ctx: CanvasRenderingContext2D, items: InkItem[], o: DrawOpts = {}) {
  for (const it of items) drawItem(ctx, it, o);
}

/**
 * The image the AI reads: ink only, black on white, cropped to the ink (+ padding), longest side ≤ 512 px.
 * Returns null when there is no ink.
 */
export async function exportInk(items: InkItem[], max = 512, labels?: string[], layout: WsLayout = "side"): Promise<{ blob: Blob; plan: CropPlan } | null> {
  const ink = inkBounds(items);
  if (!ink) return null;
  // A worksheet keeps its printed labels in the picture, so every line can be matched to its part.
  const plan = labels?.length ? cropPlan(worksheetBox(items, labels, layout), 8, max) : cropPlan(ink, 16, max);
  const c = document.createElement("canvas");
  c.width = plan.outW;
  c.height = plan.outH;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(plan.scale, plan.scale);
  ctx.translate(-plan.sx, -plan.sy);
  if (labels?.length) drawWorksheet(ctx, labels, plan.sx + plan.sw, { ink: "#000", layout });
  drawItems(ctx, items, { tint: "#000", exportMode: true });
  // PNG is smallest for black-on-white line art; WebP if the browser makes it smaller.
  const png = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  const webp = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.85));
  const blob = [png, webp].filter((x): x is Blob => !!x && (x.type === "image/png" || x.type === "image/webp")).sort((a, b) => a.size - b.size)[0];
  return blob ? { blob, plan } : null;
}
