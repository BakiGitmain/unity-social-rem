import { test } from "node:test";
import assert from "node:assert/strict";
import { cropPlan, hashInk, inkBounds, itemsHit, recognizeShape, type InkItem, type Pt } from "./model.ts";
import { strokeOutline } from "./render.ts";
import {
  answerText,
  createRecognizer,
  gradeAnswer,
  inkMode,
  needsConfirm,
  parseRecognition,
  type Recognition,
} from "./recognition.ts";

const stroke = (id: string, pts: [number, number][], tool: "pen" | "highlighter" = "pen"): InkItem => ({
  id,
  type: "stroke",
  tool,
  color: "#111",
  size: 4,
  pts: pts.map(([x, y]) => [x, y, 0.5] as Pt),
});

/* ---------------- stroke → crop → downscale ---------------- */

test("ink bounds cover every stroke (highlighter ignored)", () => {
  const items = [stroke("a", [[100, 50], [140, 80]]), stroke("b", [[300, 60], [320, 90]]), stroke("h", [[0, 0], [900, 900]], "highlighter")];
  const b = inkBounds(items)!;
  assert.ok(b.minX <= 100 - 2 && b.maxX >= 320 + 2);
  assert.ok(b.minY <= 50 - 2 && b.maxY >= 90 + 2);
  assert.ok(b.maxX < 400, "highlighter is not part of the answer");
  assert.equal(inkBounds([]), null);
});

test("crop plan: padding, longest side ≤ 512, small ink enlarged at most 2×", () => {
  const big = cropPlan({ minX: 0, minY: 0, maxX: 2000, maxY: 300 });
  assert.equal(big.sx, -16);
  assert.equal(big.sw, 2032);
  assert.ok(big.outW <= 512 && big.outH <= 512);
  assert.equal(big.outW, 512);
  const small = cropPlan({ minX: 10, minY: 10, maxX: 50, maxY: 30 });
  assert.equal(small.scale, 2);
  assert.equal(small.outW, small.sw * 2);
});

test("every ink point maps inside the exported image", () => {
  const items = [stroke("a", [[37, 412], [610, 433], [1210, 380]])];
  const plan = cropPlan(inkBounds(items)!);
  for (const [x, y] of (items[0] as Extract<InkItem, { type: "stroke" }>).pts) {
    const ox = (x - plan.sx) * plan.scale;
    const oy = (y - plan.sy) * plan.scale;
    assert.ok(ox > 0 && ox < plan.outW && oy > 0 && oy < plan.outH);
  }
});

test("perfect-freehand gives a closed outline polygon", () => {
  const out = strokeOutline({ pts: [[0, 0, 0.5], [10, 5, 0.5], [20, 10, 0.5], [30, 12, 0.5]], size: 4, pressure: false });
  assert.ok(out.length > 6);
  assert.ok(out.every((p) => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])));
});

test("the ink hash is stable and changes with the ink", () => {
  const a = [stroke("a", [[1, 2], [3, 4]])];
  assert.equal(hashInk(a, "set"), hashInk([stroke("other-id", [[1.2, 2.1], [3, 4]])], "set"));
  assert.notEqual(hashInk(a, "set"), hashInk([stroke("a", [[1, 2], [9, 4]])], "set"));
  assert.notEqual(hashInk(a, "set"), hashInk(a, "number"));
});

/* ---------------- eraser + smart shapes ---------------- */

test("eraser: tap hits a stroke, scribble hits several", () => {
  const items = [stroke("a", [[0, 0], [100, 0]]), stroke("b", [[0, 50], [100, 50]]), stroke("c", [[0, 200], [100, 200]])];
  assert.deepEqual(itemsHit(items, [[50, 1]], 6), ["a"]);
  assert.deepEqual(itemsHit(items, [[20, -5], [40, 55], [60, -5], [80, 55]], 6).sort(), ["a", "b"]);
});

test("smart shapes: rough circle → ellipse, rough box → rect, a line → nothing", () => {
  const circle: Pt[] = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 39) * Math.PI * 2;
    return [100 + 50 * Math.cos(a) + (i % 3) - 1, 100 + 40 * Math.sin(a) + (i % 2), 0.5];
  });
  assert.equal(recognizeShape(circle)?.shape, "ellipse");
  const box: Pt[] = [];
  for (let i = 0; i <= 10; i++) box.push([i * 10, 0, 0.5]);
  for (let i = 0; i <= 10; i++) box.push([100, i * 8, 0.5]);
  for (let i = 10; i >= 0; i--) box.push([i * 10, 80, 0.5]);
  for (let i = 10; i >= 0; i--) box.push([0, i * 8, 0.5]);
  assert.equal(recognizeShape(box)?.shape, "rect");
  const line: Pt[] = Array.from({ length: 20 }, (_, i) => [i * 10, i * 3, 0.5]);
  assert.equal(recognizeShape(line), null);
});

/* ---------------- JSON schema validation ---------------- */

test("recognition: valid output accepted, anything else rejected", () => {
  const ok = { latex: "\\{1, 2\\}", type: "set", elements: ["1", "2"], value: null, confidence: 0.93 };
  assert.deepEqual(parseRecognition(ok), ok);
  assert.equal(parseRecognition({ ...ok, confidence: 1.5 }), null);
  assert.equal(parseRecognition({ ...ok, type: "essay" }), null);
  assert.equal(parseRecognition({ ...ok, elements: [1, 2] }), null);
  assert.equal(parseRecognition({ ...ok, extra: "x" }), null);
  assert.equal(parseRecognition({ latex: "1" }), null);
  assert.equal(parseRecognition("{}"), null);
  assert.equal(parseRecognition(null), null);
});

/* ---------------- set checker with recognised answers ---------------- */

test("recognised sets are graded by our checker (order, duplicates, ∅)", () => {
  const read = (elements: string[] | null, latex = ""): Recognition => ({ latex, type: "set", elements, value: null, confidence: 0.95 });
  assert.equal(gradeAnswer(answerText(read(["3", "1", "2", "2"]), "set"), "set", ["1", "2", "3"]).correct, true);
  assert.equal(gradeAnswer(answerText(read([]), "set"), "set", []).correct, true);
  assert.equal(answerText(read(null, "\\emptyset"), "set"), "∅");
  assert.equal(answerText(read(null, "\\{-1, 0, 1\\}"), "set"), "{-1, 0, 1}");
  const missing = gradeAnswer(answerText(read(["1", "2"]), "set"), "set", ["1", "2", "3"]);
  assert.equal(missing.correct, false);
  assert.match(missing.message, /missing 1 element/);
  const num: Recognition = { latex: "-4", type: "number", elements: null, value: -4, confidence: 0.9 };
  assert.equal(gradeAnswer(answerText(num, "number"), "number", -4).correct, true);
  assert.equal(answerText({ ...num, value: null, latex: "\\frac{3}{4}" }, "number"), "(3)/(4)");
  assert.equal(gradeAnswer("(3)/(4)", "number", 0.75).correct, true);
});

test("low confidence or unreadable → ask before grading", () => {
  assert.equal(needsConfirm({ latex: "", type: "unreadable", elements: null, value: null, confidence: 0.9 }), true);
  assert.equal(needsConfirm({ latex: "1", type: "number", elements: null, value: 1, confidence: 0.79 }), true);
  assert.equal(needsConfirm({ latex: "1", type: "number", elements: null, value: 1, confidence: 0.8 }), false);
});

/* ---------------- cache hit ---------------- */

test("cache: the same ink never calls the AI twice", async () => {
  let calls = 0;
  const store = new Map<string, Recognition>();
  const recognize = createRecognizer(
    async () => {
      calls++;
      return { latex: "\\{1\\}", type: "set", elements: ["1"], value: null, confidence: 0.99 } as Recognition;
    },
    { get: (k) => store.get(k), set: (k, v) => void store.set(k, v) },
  );
  const a = await recognize("hash-1", () => ({}));
  const b = await recognize("hash-1", () => ({}));
  assert.equal(calls, 1);
  assert.equal(a.cached, false);
  assert.equal(b.cached, true);
  await Promise.all([recognize("hash-2", () => ({})), recognize("hash-2", () => ({}))]);
  assert.equal(calls, 2, "concurrent checks share one request");
});

test("unreadable results are not cached", async () => {
  let calls = 0;
  const store = new Map<string, Recognition>();
  const recognize = createRecognizer(async () => (calls++, { latex: "", type: "unreadable", elements: null, value: null, confidence: 0 }) as Recognition, {
    get: (k) => store.get(k),
    set: (k, v) => void store.set(k, v),
  });
  await recognize("x", () => ({}));
  await recognize("x", () => ({}));
  assert.equal(calls, 2);
});

/* ---------------- fallback ---------------- */

test("fallback to typing when AI is off, over the limit or logged out", () => {
  assert.deepEqual(inkMode({ loggedIn: true, available: true, checks: 3, limit: 60 }), { mode: "ink", note: null });
  assert.equal(inkMode({ loggedIn: false }).mode, "type");
  assert.equal(inkMode({ loggedIn: true, available: false, reason: "off" }).mode, "type");
  assert.match(inkMode({ loggedIn: true, available: false, reason: "budget" }).note!, /resting/);
  assert.equal(inkMode({ loggedIn: true, available: true, checks: 60, limit: 60 }).mode, "type");
});

/* ---------------- server image validation ---------------- */

import { checkImage, MAX_IMAGE_BYTES } from "./image.ts";

test("image check: PNG accepted, junk and oversized images rejected", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString("base64");
  const r = checkImage(png);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.mediaType, "image/png");
  assert.deepEqual(checkImage(Buffer.from("hello world").toString("base64")), { ok: false, error: "bad_image" });
  assert.deepEqual(checkImage("not base64!!"), { ok: false, error: "bad_image" });
  assert.deepEqual(checkImage(Buffer.alloc(MAX_IMAGE_BYTES + 10, 1).toString("base64")), { ok: false, error: "too_big" });
  assert.deepEqual(checkImage(undefined), { ok: false, error: "bad_image" });
});

/* ---------------- text tool, select / move tool ---------------- */

import { autoFormat, createHistory, splitWorksheet } from "./text.ts";
import { boxSelect, deleteItems, duplicateItems, moveItems, reorder, rotateItems, scaleItems, selectionBox, snap } from "./transform.ts";
import { rowHeight, ROW_TOP, type InkText } from "./model.ts";

const textItem = (id: string, text: string, x: number, y: number): InkText => ({ id, type: "text", text, x, y, w: text.length * 12, h: 30, size: 24, color: "#111" });

test("text shortcuts: \\cup → ∪ when the word is finished, U stays a letter, ^2 and -> at once", () => {
  assert.equal(autoFormat("A \\cup B"), "A ∪ B");
  assert.equal(autoFormat("U"), "U");
  assert.equal(autoFormat("A \\cap B, x \\in A, \\empty"), "A ∩ B, x ∈ A, \\empty");
  assert.equal(autoFormat("\\empty", true), "∅");
  assert.equal(autoFormat("\\subset"), "\\subset", "may still become \\subseteq while typing");
  assert.equal(autoFormat("\\subseteq ", false), "⊆ ");
  assert.equal(autoFormat("x^2 -> y"), "x² → y");
  assert.equal(autoFormat("\\unknown "), "\\unknown ");
});

test("undo / redo of text edits (add, edit, move, delete)", () => {
  const h = createHistory<InkText[]>([]);
  h.push([textItem("t", "{1, 2}", 10, 10)]); // add
  h.push([{ ...textItem("t", "{1, 2, 3}", 10, 10) }]); // edit
  h.push(moveItems(h.present, new Set(["t"]), 30, 0) as InkText[]); // move
  h.push([]); // delete
  assert.equal(h.present.length, 0);
  assert.equal(h.undo()[0]!.x, 40);
  assert.equal(h.undo()[0]!.text, "{1, 2, 3}");
  assert.equal(h.undo()[0]!.text, "{1, 2}");
  assert.equal(h.redo()[0]!.text, "{1, 2, 3}");
  assert.equal(h.canRedo, true);
  h.push([textItem("t", "new", 0, 0)]);
  assert.equal(h.canRedo, false, "a new change clears redo");
});

test("typed answers are read directly (no AI); only handwritten lines go to the AI", () => {
  const rh = rowHeight("side");
  const y = (row: number) => ROW_TOP + row * rh + 20;
  const items = [
    textItem("a", "{2, 3, 4}", 200, y(0)), // line 0: typed
    { id: "s1", type: "symbol" as const, text: "∅", x: 230, y: y(1) + 15, size: 30, color: "#111" }, // line 1: a placed symbol
    stroke("ink", [[200, y(2) + 10], [260, y(2) + 20]]), // line 2: handwriting
  ];
  const sp = splitWorksheet(items, 3, "side");
  assert.equal(sp.typed.get(0), "{2, 3, 4}");
  assert.equal(sp.typed.get(1), "∅");
  assert.deepEqual(sp.inkRows, [2]);
  // the handwritten line is moved up to line 0 for the AI image
  const b = inkBounds(sp.inkItems)!;
  assert.ok(b.minY >= ROW_TOP && b.maxY <= ROW_TOP + rh, "ink sits on the first line of the AI image");
  // grading the typed lines with our checker: no AI involved
  assert.equal(gradeAnswer(sp.typed.get(0)!, "set", ["2", "3", "4"]).correct, true);
  assert.equal(gradeAnswer(sp.typed.get(1)!, "set", []).correct, true);
});

test("select / move: move, resize, rotate, duplicate, delete, reorder, box select, snap", () => {
  const items = [textItem("a", "abc", 0, 0), stroke("b", [[100, 100], [140, 120]]), { id: "c", type: "shape" as const, shape: "rect" as const, x1: 200, y1: 0, x2: 260, y2: 40, color: "#111", size: 3 }];
  const one = new Set(["a"]);
  assert.equal((moveItems(items, one, 5, 7)[0] as InkText).x, 5);
  const box = selectionBox(items, new Set(["c"]))!;
  const big = scaleItems(items, new Set(["c"]), box, { ...box, maxX: box.minX + (box.maxX - box.minX) * 2 });
  assert.ok(selectionBox(big, new Set(["c"]))!.maxX > box.maxX + 50);
  const rot = rotateItems(items, new Set(["c"]), Math.PI / 2);
  assert.ok(Math.abs(((rot[2] as { rot?: number }).rot ?? 0) - Math.PI / 2) < 1e-9);
  const dup = duplicateItems(items, one);
  assert.equal(dup.items.length, 4);
  assert.ok(!dup.ids.has("a"));
  assert.equal(deleteItems(items, one).length, 2);
  assert.deepEqual(reorder(items, one, 1).map((i) => i.id), ["b", "a", "c"]);
  assert.deepEqual([...boxSelect(items, { minX: 90, minY: 90, maxX: 300, maxY: 130 })].sort(), ["b"]);
  const s = snap({ minX: 103, minY: 300, maxX: 150, maxY: 320 }, [{ minX: 100, minY: 0, maxX: 120, maxY: 10 }], [318]);
  assert.equal(s.dx, -3);
  assert.equal(s.dy, -2);
  assert.equal(s.guides.length, 2);
});
