import { test } from "node:test";
import assert from "node:assert/strict";
import { VENN_LAYOUT, canonicalRegion, extractVenn, parseVennSpec, regionMeaning, regionNumber, stripTextArt, vennCaption } from "./venn.ts";
import { REGIONS } from "../math/venn.ts";

const ANSWER = `**A ∩ B = {3}**
1. Region 2 is inside both circles.
VENN: {"sets":["A","B"],"shade":"A ∩ B","elements":{"A":[1,2],"AB":[3],"B":[4,5],"none":[6]},"names":{"A":"odd numbers"}}
💡 Tip: ∩ looks like n for "and".
FOLLOWUPS: What is A ∪ B? | What is A′?`;

test("the VENN line is removed from the text and parsed", () => {
  const { text, spec } = extractVenn(ANSWER);
  assert.ok(!text.includes("VENN"));
  assert.ok(text.includes("FOLLOWUPS:") && text.includes("💡 Tip"));
  assert.deepEqual(spec, {
    size: 2,
    labels: ["A", "B"],
    names: ["odd numbers", null],
    shade: "A ∩ B",
    shaded: ["AB"],
    elements: { A: ["1", "2"], AB: ["3"], B: ["4", "5"], none: ["6"] },
  });
});

test("bad or missing VENN data never shows raw JSON", () => {
  assert.deepEqual(extractVenn("Hello\nVENN: {not json}\nBye"), { text: "Hello\nBye", spec: null });
  assert.deepEqual(extractVenn("No diagram here"), { text: "No diagram here", spec: null });
  assert.equal(parseVennSpec({ sets: ["A"] }), null);
  assert.equal(parseVennSpec({ sets: ["A", "B", "C", "D"] }), null);
  // An unreadable expression just means no shading.
  assert.deepEqual(parseVennSpec({ sets: ["A", "B"], shade: "A ⋈ B" })!.shaded, []);
});

test("custom letters, words as set names, region keys in any form", () => {
  const s = parseVennSpec({ sets: ["F", "B", "V"], shade: "(F ∪ B) ∖ V", elements: { "B∩F": [3], "F,B,V": [6], outside: [9] } })!;
  assert.deepEqual(s.labels, ["F", "B", "V"]);
  assert.deepEqual(s.shaded, ["A", "B", "AB"]);
  assert.deepEqual(s.elements, { AB: ["3"], ABC: ["6"], none: ["9"] });
  const w = parseVennSpec({ sets: ["Football", "Basketball"], shade: "A ∪ B" })!;
  assert.deepEqual(w.labels, ["A", "B"]);
  assert.deepEqual(w.names, ["Football", "Basketball"]);
  assert.deepEqual(w.shaded, ["A", "AB", "B"]);
  assert.equal(canonicalRegion("Z", ["A", "B"], 2), null);
  assert.equal(canonicalRegion("AC", ["A", "B"], 2), null);
});

test("region numbers match the prompt (2 sets: 1 A only, 2 both, 3 B only, 4 outside)", () => {
  assert.deepEqual(REGIONS[2].map((r) => regionNumber(2, r)), [1, 2, 3, 4]);
  assert.equal(regionNumber(3, "AB"), 4);
  assert.equal(regionNumber(3, "ABC"), 7);
  assert.equal(regionNumber(3, "none"), 8);
  const spec = { size: 3 as const, labels: ["F", "B", "V"] };
  assert.equal(regionMeaning("AC", spec, "en"), "F ∩ V only");
  assert.equal(regionMeaning("ABC", spec, "am"), "F ∩ B ∩ V");
  assert.equal(regionMeaning("none", spec, "am"), "ከሁሉም ውጪ");
});

test("every region's label point is really inside that region", () => {
  for (const size of [2, 3] as const) {
    const L = VENN_LAYOUT[size];
    for (const region of REGIONS[size]) {
      const [x, y] = L.regions[region]!.at;
      const inside = L.centers.map(([cx, cy]) => Math.hypot(x - cx, y - cy) < L.r - 12);
      const expected = ["A", "B", "C"].slice(0, size).map((c) => region !== "none" && region.includes(c));
      assert.deepEqual(inside, expected, `${size} sets, region ${region}`);
      assert.ok(x > 16 && x < L.width - 16 && y > 16 && y < L.height - 16);
    }
  }
});

test("caption: names, shading, numbered regions; non-ASCII elements listed in the caption", () => {
  const { spec } = extractVenn(ANSWER);
  const en = vennCaption(spec!, "en");
  assert.match(en, /A = odd numbers/);
  assert.match(en, /Shaded: <b>A ∩ B<\/b>/);
  assert.match(en, /① A only · ② A ∩ B · ③ B only · ④ outside both/);
  const am = vennCaption(parseVennSpec({ sets: ["A", "B"], elements: { A: ["ሀ"], AB: ["ለ"] } })!, "am");
  assert.match(am, /① A ብቻ: \{ሀ\}\n② A ∩ B: \{ለ\}\n③ B ብቻ\n④ ከሁለቱም ውጪ/);
  assert.ok(am.length <= 1024);
});

test("text-art drawings are removed, normal text and code are kept", () => {
  const art = "**Union**\n```\n   _____     _____\n  /     \   /     \\n |   A   | |   B   |\n  \_____/   \_____/\n```\nRegion 2 is shared.";
  assert.equal(stripTextArt(art), "**Union**\nRegion 2 is shared.");
  assert.equal(stripTextArt("A\n╭───╮\n│ A │\n╰───╯\nB"), "A\nB");
  const code = "```\nx = 2 + 3\ny = x * 4\n```";
  assert.equal(stripTextArt(code), code);
  assert.equal(stripTextArt("| Set | Meaning |\n|---|---|\n| A ∪ B | union |"), "| Set | Meaning |\n|---|---|\n| A ∪ B | union |");
});

test("legend: never 'A = A'; shows the set's elements instead, or nothing", () => {
  const trivial = parseVennSpec({ sets: ["A", "B"], names: { A: "A", B: "Set B" }, elements: { A: [2, 1], AB: [3], B: [4] } })!;
  assert.match(vennCaption(trivial, "en"), /^🔵 <b>Venn diagram<\/b>\nA = \{1, 2, 3\} · B = \{3, 4\}\n/);
  const bare = parseVennSpec({ sets: ["A", "B"], names: { A: "A", B: "B" }, shade: "A ∪ B" })!;
  assert.ok(!/A = A|B = B|A = \{/.test(vennCaption(bare, "en")));
  assert.match(vennCaption(bare, "en"), /^🔵 <b>Venn diagram<\/b>\n🟨 Shaded/);
  const named = parseVennSpec({ sets: ["F", "B"], names: { F: "football" }, elements: { F: ["x"], B: ["y"] } })!;
  assert.match(vennCaption(named, "am"), /F = football · B = \{y\}/);
});
