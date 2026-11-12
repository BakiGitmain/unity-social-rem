/**
 * Outline view: the whole board as a clean nested list (reading mode on small phones, printing, Markdown export).
 * Order (in each group: the board, or one frame): first the ROOT cards (connected, but no arrow points to them, e.g. a
 * mind map's centre), each followed by its children in tree order (following the arrows, depth first); then the cards
 * without any connection, top to bottom, then left to right (rows within 40 px count as one row). Cards inside a frame
 * are listed under it. Connections become "→ linked to …". Pure (tested).
 */
import { cardText, type BoardEdge, type BoardNode, type Board } from "./types.ts";

export type OutlineItem = { node: BoardNode; title: string; text: string; links: { to: string; label?: string }[]; children: OutlineItem[] };

const ROW = 40;
export function readingOrder(a: BoardNode, b: BoardNode): number {
  const ra = Math.round(a.y / ROW),
    rb = Math.round(b.y / ROW);
  return ra !== rb ? ra - rb : a.x - b.x || a.y - b.y;
}

/** Is a card inside a frame (by its parent, or by its centre lying inside the frame)? */
export function frameOf(n: BoardNode, frames: BoardNode[]): BoardNode | null {
  if (n.parent) return frames.find((f) => f.id === n.parent) ?? null;
  const cx = n.x + n.w / 2,
    cy = n.y + n.h / 2;
  return frames.find((f) => f.id !== n.id && cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h) ?? null;
}

export function titleOf(n: BoardNode): string {
  const d = n.data;
  const t = d.title?.trim() || (n.type === "quote" ? d.quote?.text : "") || (n.type === "link" ? d.link?.title || d.link?.url : "") || (d.body ?? "").split("\n")[0];
  const fallback: Record<string, string> = { image: "Image", drawing: "Drawing", checklist: "Checklist", frame: "Group", sticky: "Sticky note", note: "Note" };
  return (t || fallback[n.type] || "Card").replace(/^#+\s*/, "").slice(0, 120);
}

export function buildOutline(nodes: BoardNode[], edges: BoardEdge[]): OutlineItem[] {
  const frames = nodes.filter((n) => n.type === "frame");
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const item = (n: BoardNode): OutlineItem => ({
    node: n,
    title: titleOf(n),
    text: n.type === "frame" ? "" : cardText(n),
    links: edges
      .filter((e) => e.source === n.id && byId.has(e.target))
      .map((e) => ({ to: titleOf(byId.get(e.target)!), label: e.label || undefined })),
    children: [],
  });
  const top: OutlineItem[] = [];
  const frameItems = new Map<string, OutlineItem>();
  for (const f of frames) frameItems.set(f.id, item(f));
  for (const n of nodes) {
    if (n.type === "frame") continue;
    const f = frameOf(n, frames);
    if (f) frameItems.get(f.id)!.children.push(item(n));
    else top.push(item(n));
  }
  for (const f of frameItems.values()) f.children = treeOrder(f.children, edges);
  return treeOrder([...top, ...frameItems.values()], edges);
}

/** Roots → their children (depth first, following arrows) → unconnected cards in reading order. */
export function treeOrder(items: OutlineItem[], edges: BoardEdge[]): OutlineItem[] {
  const byId = new Map(items.map((i) => [i.node.id, i]));
  const kids = new Map<string, string[]>();
  const incoming = new Set<string>();
  const connected = new Set<string>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target) continue;
    kids.set(e.source, [...(kids.get(e.source) ?? []), e.target]);
    incoming.add(e.target);
    connected.add(e.source).add(e.target);
  }
  const byReading = (a: string, b: string) => readingOrder(byId.get(a)!.node, byId.get(b)!.node);
  const out: OutlineItem[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(byId.get(id)!);
    for (const k of [...(kids.get(id) ?? [])].sort(byReading)) visit(k);
  };
  const ids = items.map((i) => i.node.id).sort(byReading);
  for (const id of ids) if (connected.has(id) && !incoming.has(id)) visit(id); // roots
  for (const id of ids) if (connected.has(id)) visit(id); // cycles without a root
  for (const id of ids) if (!connected.has(id)) visit(id); // unconnected, top to bottom
  return out;
}

/** Markdown export (same order as the outline). */
export function toMarkdown(board: Pick<Board, "title">, outline: OutlineItem[], lessonLabel?: string): string {
  const out: string[] = [`# ${board.title}`.trim()];
  if (lessonLabel) out.push(`_${lessonLabel}_`);
  const emit = (it: OutlineItem, depth: number) => {
    const h = "#".repeat(Math.min(6, depth + 2));
    out.push("", `${h} ${it.title}`);
    const body = it.text && it.text !== it.title ? it.text.split("\n").filter((l) => l.trim() !== it.title.trim()).join("\n").trim() : "";
    if (it.node.type === "quote" && it.node.data.quote) out.push(`> ${it.node.data.quote.text}`);
    else if (body) out.push(body);
    for (const l of it.links) out.push(`→ linked to **${l.to}**${l.label ? ` (${l.label})` : ""}`);
    for (const c of it.children) emit(c, depth + 1);
  };
  for (const it of outline) emit(it, 0);
  return out.join("\n").trim() + "\n";
}
