import { test } from "node:test";
import assert from "node:assert/strict";
import { TG_LIMITS, bar, barPct, card, clip, clipHtml, duration, esc, inlineHtml, isAmharicText, localizeTip, mdToTelegramHtml, plainMath, splitFollowups, texToPlain } from "./format.ts";

test("progress bars", () => {
  assert.equal(bar(0, 5), "▱▱▱▱▱");
  assert.equal(bar(0.6, 5), "▰▰▰▱▱");
  assert.equal(bar(1, 5), "▰▰▰▰▰");
  assert.equal(bar(2, 5), "▰▰▰▰▰");
  assert.equal(bar(-1, 5), "▱▱▱▱▱");
  assert.equal(bar(NaN, 5), "▱▱▱▱▱");
  assert.equal(barPct(3, 5, 5), "▰▰▰▱▱ 60%");
  assert.equal(barPct(0, 0, 5), "▱▱▱▱▱ 0%");
});

test("escaping for Telegram HTML", () => {
  assert.equal(esc(`a < b && c > d "x"`), `a &lt; b &amp;&amp; c &gt; d "x"`);
});

test("durations round up and read naturally in both languages", () => {
  assert.equal(duration(14.2, "en"), "15 min");
  assert.equal(duration(0.1, "en"), "1 min");
  assert.equal(duration(0, "en"), "0 min");
  assert.equal(duration(135, "en"), "2 h 15 min");
  assert.equal(duration(120, "en"), "2 h");
  assert.equal(duration(60 * 24 + 90, "en"), "1 d 1 h");
  assert.equal(duration(135, "am"), "2 ሰዓት 15 ደቂቃ");
});

test("LaTeX → Unicode", () => {
  assert.equal(texToPlain("A \\cup B"), "A ∪ B");
  assert.equal(texToPlain("(A \\cap B) \\setminus C = \\{3\\}"), "(A ∩ B) ∖ C = {3}");
  assert.equal(texToPlain("x \\in \\mathbb{R}, x^2 \\geq 0"), "x ∈ ℝ, x² ≥ 0");
  assert.equal(texToPlain("A' = \\emptyset"), "A' = ∅");
  assert.equal(texToPlain("\\frac{1}{2} + \\frac{a+b}{c}"), "1/2 + (a+b)/c");
  assert.equal(texToPlain("\\sqrt{2}, \\sqrt{x+1}"), "√2, √(x+1)");
  assert.equal(texToPlain("x_1 + x_{n}"), "x₁ + xₙ");
  assert.equal(texToPlain("n(A \\cup B) = n(A) + n(B) - n(A \\cap B)"), "n(A ∪ B) = n(A) + n(B) - n(A ∩ B)");
  assert.equal(texToPlain("5 \\notin A, 3 \\not\\in B"), "5 ∉ A, 3 ∉ B");
  assert.equal(texToPlain("\\text{if } x \\le 3"), "if x ≤ 3");
  assert.equal(texToPlain("90^\\circ"), "90°");
  assert.equal(texToPlain("A \\Delta B"), "A Δ B");
});

test("plainMath for polls and buttons", () => {
  assert.equal(plainMath("Find $A \\cup B$ when **$A = \\{1\\}$**"), "Find A ∪ B when A = {1}");
});

test("inline HTML: bold, italics, math and links, everything else escaped", () => {
  assert.equal(inlineHtml("**Union** means $A \\cup B$ <b>"), "<b>Union</b> means A ∪ B &lt;b&gt;");
  assert.equal(inlineHtml("see [the map](https://x.org/a?b=1&c=2)"), 'see <a href="https://x.org/a?b=1&amp;c=2">the map</a>');
  assert.equal(inlineHtml("an *easy* one and `code <x>`"), "an <i>easy</i> one and <code>code &lt;x&gt;</code>");
  assert.equal(inlineHtml("$a < b$"), "a &lt; b");
  assert.equal(inlineHtml("2 * 3 * 4"), "2 * 3 * 4");
});

test("Rem's Markdown → Telegram HTML (steps, tip, headings, tables, math blocks)", () => {
  const md = [
    "**$A \\cap B = \\{3, 4\\}$**",
    "",
    "1. Look at A = {1, 2, 3, 4}.",
    "2. Keep what is also in B → $\\{3, 4\\}$",
    "",
    "### Compare",
    "| Operation | In simple words | Symbol |",
    "|---|---|---|",
    "| Union | put together | $\\cup$ |",
    "| Intersection | in both | $\\cap$ |",
    "",
    "$$A \\setminus B$$",
    "",
    "- one",
    "  - two",
    "> quoted",
    "",
    "💡 Tip: brackets first!",
  ].join("\n");
  const html = mdToTelegramHtml(md);
  assert.equal(
    html,
    [
      "<b>A ∩ B = {3, 4}</b>",
      "",
      "<b>1.</b> Look at A = {1, 2, 3, 4}.",
      "<b>2.</b> Keep what is also in B → {3, 4}",
      "",
      "<b>Compare</b>",
      "<i>Operation · In simple words · Symbol</i>",
      "▸ <b>Union</b> — put together · ∪",
      "▸ <b>Intersection</b> — in both · ∩",
      "",
      "<code>A ∖ B</code>",
      "",
      "• one",
      "   ◦ two",
      "<blockquote>quoted</blockquote>",
      "",
      "💡 Tip: brackets first!",
    ].join("\n"),
  );
  assert.ok(!/[$\\]/.test(html));
});

test("Amharic Markdown keeps the same structure", () => {
  assert.equal(mdToTelegramHtml("**ውህደት (Union)** ማለት ሁለቱን ስብስቦች መደመር ነው።\n1. A ውሰዱ"), "<b>ውህደት (Union)</b> ማለት ሁለቱን ስብስቦች መደመር ነው።\n<b>1.</b> A ውሰዱ");
});

test("follow-up line is split off", () => {
  assert.deepEqual(splitFollowups("**Answer**\nText\nFOLLOWUPS: What is a set? | Give an example | Quiz me"), {
    body: "**Answer**\nText",
    followups: ["What is a set?", "Give an example", "Quiz me"],
  });
  assert.deepEqual(splitFollowups("No followups"), { body: "No followups", followups: [] });
});

test("cards: icon + bold upper-case title, divider, sections, never over Telegram's limit", () => {
  const c = card({ icon: "📅", title: "Today", subtitle: "Monday · Nov 16", sections: ["a", "", null, "b"], footer: "f" });
  assert.equal(c, "📅 <b>TODAY</b>\n<i>Monday · Nov 16</i>\n\n━━━━━━━━━━━━━━━━\n\na\n\nb\n\n<i>f</i>");
  const huge = card({ icon: "x", title: "t", sections: [Array.from({ length: 400 }, (_, i) => `<b>line ${i}</b> ${"word ".repeat(5)}`).join("\n")] });
  assert.ok(huge.length <= TG_LIMITS.message);
  assert.ok(huge.endsWith("…"));
});

test("clipping never leaves a tag open", () => {
  const out = clipHtml("<b>one\ntwo\nthree</b>", 12);
  assert.equal((out.match(/<b>/g) ?? []).length, (out.match(/<\/b>/g) ?? []).length);
  assert.equal(clip("abcdef", 4), "abc…");
  assert.equal(clip("ሀለሐመሠረ", 4), "ሀለሐ…");
});

test("Amharic answers say ጠቃሚ ምክር፡ instead of Tip:", () => {
  assert.equal(isAmharicText("**ኅብረት ማለት** የሁለቱም አባላት ነው (Union)"), true);
  assert.equal(isAmharicText("**Union** means everything in A or B"), false);
  const am = "**ኅብረት** ሁሉንም አባላት ይይዛል።\n1. ሀ\n💡 Tip: ∪ ቅርጹ ልክ እንደ U ነው።";
  assert.equal(localizeTip(am).split("\n")[2], "💡 ጠቃሚ ምክር፡ ∪ ቅርጹ ልክ እንደ U ነው።");
  assert.equal(localizeTip("ስብስብ ማለት ቡድን ነው\n**💡 Tip:** ቀላል ነው").split("\n")[1], "**💡 ጠቃሚ ምክር፡** ቀላል ነው");
  assert.equal(localizeTip("ስብስብ ማለት ቡድን ነው\nTip: ቀላል ነው").split("\n")[1], "💡 ጠቃሚ ምክር፡ ቀላል ነው");
  assert.match(mdToTelegramHtml(localizeTip(am)), /💡 ጠቃሚ ምክር፡/);
  // English answers keep "Tip:"; "Tip" inside a sentence is untouched.
  assert.equal(localizeTip("**Union**\n💡 Tip: think U"), "**Union**\n💡 Tip: think U");
  assert.equal(localizeTip("ይህ Tipping point ነው፣ ምንም ለውጥ የለም"), "ይህ Tipping point ነው፣ ምንም ለውጥ የለም");
});
