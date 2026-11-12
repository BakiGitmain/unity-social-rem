import { test } from "node:test";
import assert from "node:assert/strict";
import { NEW_CARD, review, isDue, previewInterval } from "./srs.ts";
import { buildOutline, toMarkdown } from "./outline.ts";
import { diff, mergePending, syncOnce, isEmpty, EMPTY_PENDING, type SyncApi } from "./sync.ts";
import { tidy, freeSpot, boundsOf } from "./layout.ts";
import { buildTemplate, TEMPLATES } from "./templates.ts";
import type { BoardEdge, BoardNode, BoardState } from "./types.ts";

const T0 = new Date("2026-11-12T08:00:00Z");
const DAY = 86_400_000;
const node = (id: string, x: number, y: number, title: string, extra: Partial<BoardNode> = {}): BoardNode => ({
  id,
  type: "note",
  x,
  y,
  w: 200,
  h: 100,
  z: 1,
  data: { title, body: `${title} body` },
  updated_at: "2026-11-12T08:00:00Z",
  ...extra,
});
const edge = (id: string, source: string, target: string, label?: string): BoardEdge => ({ id, source, target, label, updated_at: "2026-11-12T08:00:00Z" });

/* ---------------- SM-2 ---------------- */

test("SM-2: good → 1 day, 6 days, then × ease", () => {
  let s = NEW_CARD(T0);
  assert.equal(isDue(s, T0), true);
  s = review(s, "good", T0);
  assert.equal(s.interval, 1);
  assert.equal(s.reps, 1);
  assert.equal(new Date(s.due_at).getTime() - T0.getTime(), DAY);
  s = review(s, "good", T0);
  assert.equal(s.interval, 6);
  s = review(s, "good", T0);
  assert.equal(s.interval, Math.round(6 * s.ease));
  assert.equal(isDue(s, T0), false);
});

test("SM-2: again resets and shows the card again in 10 minutes; ease never below 1.3", () => {
  let s = review(review(NEW_CARD(T0), "good", T0), "good", T0);
  s = review(s, "again", T0);
  assert.equal(s.reps, 0);
  assert.equal(s.interval, 0);
  assert.equal(s.lapses, 1);
  assert.equal(new Date(s.due_at).getTime() - T0.getTime(), 10 * 60_000);
  for (let i = 0; i < 20; i++) s = review(s, "again", T0);
  assert.equal(s.ease, 1.3);
});

test("SM-2: easy grows faster than good, hard slower; easy raises the ease", () => {
  const base = review(review(NEW_CARD(T0), "good", T0), "good", T0);
  const easy = review(base, "easy", T0),
    good = review(base, "good", T0),
    hard = review(base, "hard", T0);
  assert.ok(easy.interval > good.interval && good.interval > hard.interval);
  assert.ok(easy.ease > base.ease && hard.ease < base.ease);
  assert.equal(previewInterval(NEW_CARD(T0), "again", T0), "10 min");
  assert.equal(previewInterval(NEW_CARD(T0), "easy", T0), "4 d");
});

/* ---------------- outline ---------------- */

test("outline: reading order, cards grouped under their frame, links as '→ linked to'", () => {
  const frame = node("f", 0, 400, "Causes", { type: "frame", w: 500, h: 300 });
  const nodes = [
    node("c", 300, 10, "Second on row 1"), // same row as a (y within 40px) → after it (x larger)
    node("a", 0, 0, "First"),
    node("b", 0, 200, "Row 2"),
    node("in2", 220, 450, "Inside B"),
    node("in1", 20, 450, "Inside A", { parent: "f" }),
    frame,
  ];
  const out = buildOutline(nodes, [edge("e1", "a", "b", "causes")]);
  assert.deepEqual(
    out.map((i) => i.title),
    ["First", "Row 2", "Second on row 1", "Causes"], // a → b connected first, then the rest top to bottom
  );
  assert.deepEqual(
    out[3]!.children.map((i) => i.title),
    ["Inside A", "Inside B"],
  );
  assert.deepEqual(out[0]!.links, [{ to: "Row 2", label: "causes" }]);
  const md = toMarkdown({ title: "Board" }, out, "Geography · 1.1.4");
  assert.match(md, /^# Board/);
  assert.match(md, /→ linked to \*\*Row 2\*\* \(causes\)/);
  assert.ok(md.indexOf("Inside A") > md.indexOf("## Causes"));
});

/* ---------------- offline save, then sync ---------------- */

const state = (nodes: BoardNode[], edges: BoardEdge[] = []): BoardState => ({
  board: { id: "b", lesson_id: "l", title: "B", emoji: "notebook", colour: "teal", template: "blank", created_at: "x", updated_at: "x" },
  nodes,
  edges,
});

test("diff + pending queue: only changed cards, deletes, newer version wins", () => {
  const s1 = state([node("a", 0, 0, "A"), node("b", 0, 0, "B")], [edge("e", "a", "b")]);
  const s2 = state([node("a", 50, 0, "A"), node("c", 0, 0, "C")]);
  const d = diff(s1, s2);
  assert.deepEqual(Object.keys(d.nodes).sort(), ["a", "c"]);
  assert.deepEqual(d.deletedNodes, ["b"]);
  assert.deepEqual(d.deletedEdges, ["e"]);
  assert.equal(d.board, false);
  const later = mergePending(d, diff(s2, state([node("a", 99, 0, "A"), node("c", 0, 0, "C")])));
  assert.equal(later.nodes.a!.x, 99, "the newest version of a card is sent");
  const undeleted = mergePending(d, { ...EMPTY_PENDING, nodes: { b: node("b", 0, 0, "B") } });
  assert.ok(!undeleted.deletedNodes.includes("b"), "re-adding a card cancels its delete");
});

test("offline save then sync: nothing is lost while offline; everything is sent when back online", async () => {
  const sent: string[] = [];
  let online = false;
  const api: SyncApi = {
    saveBoard: async () => {
      if (!online) throw new Error("offline");
      sent.push("board");
    },
    upsertNodes: async (n) => void sent.push(...n.map((x) => `node:${x.id}`)),
    upsertEdges: async (e) => void sent.push(...e.map((x) => `edge:${x.id}`)),
    deleteNodes: async (ids) => void sent.push(...ids.map((x) => `del:${x}`)),
    deleteEdges: async (ids) => void sent.push(...ids.map((x) => `deledge:${x}`)),
  };
  const s = state([node("a", 0, 0, "A"), node("b", 0, 0, "B")], [edge("e", "a", "b")]);
  let pending = diff(null, s);
  const r1 = await syncOnce(s, pending, api);
  assert.equal(r1.ok, false);
  assert.deepEqual(r1.pending, pending, "kept while offline");
  // more edits while offline
  const s2 = state([node("a", 10, 0, "A edited")], []);
  pending = mergePending(r1.pending, diff(s, s2));
  online = true;
  const r2 = await syncOnce(s2, pending, api);
  assert.equal(r2.ok, true);
  assert.ok(isEmpty(r2.pending));
  assert.ok(sent.includes("board") && sent.includes("node:a"));
  assert.ok(!sent.includes("node:b") && !sent.includes("edge:e"), "a card created and deleted offline is never sent");
});

/* ---------------- tidy up + templates ---------------- */

test("tidy: connected cards become a left-to-right tree, others a grid below", () => {
  const nodes = [node("root", 500, 500, "Root"), node("k1", 10, 10, "K1"), node("k2", 900, 50, "K2"), node("lonely", 0, 0, "Alone")];
  const pos = tidy(nodes, [edge("1", "root", "k1"), edge("2", "root", "k2")]);
  const r = pos.get("root")!,
    a = pos.get("k1")!,
    b = pos.get("k2")!,
    l = pos.get("lonely")!;
  assert.ok(a.x > r.x && b.x > r.x, "children to the right");
  assert.equal(a.x, b.x);
  assert.ok(a.y < b.y);
  assert.ok(r.y > a.y && r.y < b.y, "parent centred on its children");
  assert.ok(l.y > b.y, "unconnected cards below");
  for (const p of pos.values()) assert.equal(p.x % 20, 0);
});

test("every template builds valid cards and arrows", () => {
  for (const t of TEMPLATES) {
    const { nodes, edges } = buildTemplate(t.id, "Topic");
    const ids = new Set(nodes.map((n) => n.id));
    assert.equal(ids.size, nodes.length);
    for (const e of edges) assert.ok(ids.has(e.source) && ids.has(e.target), `${t.id}: arrow ends exist`);
    for (const n of nodes) if (n.parent) assert.ok(ids.has(n.parent), `${t.id}: frame exists`);
    if (t.id !== "blank") assert.ok(nodes.length > 0, `${t.id} has cards`);
  }
});

test("outline: root cards first, then their children in tree order, then unconnected cards top to bottom", () => {
  const nodes = [
    node("lone1", 0, 0, "Lonely top"), // unconnected, highest on the board
    node("k2", 600, 400, "Child 2"),
    node("centre", 300, 300, "Centre"), // mind-map centre: no arrow points to it
    node("k1", 600, 200, "Child 1"),
    node("g1", 900, 200, "Grandchild"),
    node("lone2", 0, 900, "Lonely bottom"),
  ];
  const edges = [edge("1", "centre", "k2"), edge("2", "centre", "k1"), edge("3", "k1", "g1")];
  assert.deepEqual(
    buildOutline(nodes, edges).map((i) => i.title),
    ["Centre", "Child 1", "Grandchild", "Child 2", "Lonely top", "Lonely bottom"],
  );
  // a loop without a root still lists every card once
  const loop = buildOutline([node("a", 0, 0, "A"), node("b", 0, 200, "B")], [edge("1", "a", "b"), edge("2", "b", "a")]);
  assert.deepEqual(loop.map((i) => i.title), ["A", "B"]);
});

test("new cards go in an empty spot near the view, never on top of another card", () => {
  const nodes = [node("a", 0, 0, "A"), node("b", 220, 0, "B"), node("c", 0, 120, "C")];
  // empty board: centred on the point
  assert.deepEqual(freeSpot([], 200, 100, { x: 100, y: 50 }), { x: 0, y: 0 });
  // crowded point: moved to the nearest free spot, with a gap around every card
  for (const near of [{ x: 100, y: 50 }, { x: 320, y: 60 }, { x: 150, y: 150 }]) {
    const p = freeSpot(nodes, 200, 100, near);
    for (const n of nodes)
      assert.ok(p.x >= n.x + n.w + 24 || p.x + 200 + 24 <= n.x || p.y >= n.y + n.h + 24 || p.y + 100 + 24 <= n.y, `overlaps ${n.id}`);
    assert.ok(Math.hypot(p.x + 100 - near.x, p.y + 50 - near.y) < 400, "stays near the view");
  }
  assert.deepEqual(boundsOf(nodes), { x: 0, y: 0, w: 420, h: 220 });
  assert.equal(boundsOf([]), null);
});
