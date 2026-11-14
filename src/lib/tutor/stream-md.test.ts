import { test } from "node:test";
import assert from "node:assert/strict";
import { fixInlineTables, healStreaming } from "./stream-md.ts";

test("streaming Markdown: open marks are closed, so raw ** never flashes", () => {
  assert.equal(healStreaming("The **main id"), "The **main id**");
  assert.equal(healStreaming("The **main idea** is *clim"), "The **main idea** is *clim*");
  assert.equal(healStreaming("Use `pri"), "Use `pri`");
  assert.equal(healStreaming("Done."), "Done.");
});

test("streaming Markdown: a mark that just started is dropped until its text arrives", () => {
  assert.equal(healStreaming("The idea is **"), "The idea is ");
  assert.equal(healStreaming("Look at $"), "Look at ");
  assert.equal(healStreaming("Try `"), "Try ");
});

test("streaming Markdown: unfinished math is hidden, finished math stays", () => {
  assert.equal(healStreaming("So $x^2 + 1$ and $y = "), "So $x^2 + 1$ and ");
  assert.equal(healStreaming("So $x^2 + 1$."), "So $x^2 + 1$.");
});

test("streaming Markdown: unfinished links show only their text; lists and code blocks are safe", () => {
  assert.equal(healStreaming("See [the map](https://exa"), "See the map");
  assert.equal(healStreaming("See [the ma"), "See the ma");
  assert.equal(healStreaming("* one\n* two"), "* one\n* two");
  assert.equal(healStreaming("```\nconst a = **b"), "```\nconst a = **b\n```");
});

test("streaming Markdown: a table shows only once its header is complete, and never a half row", () => {
  assert.equal(healStreaming("Compare:\n| Op | Meaning |"), "Compare:");
  assert.equal(healStreaming("Compare:\n| Op | Meaning |\n|---|---|\n| ∪ | join"), "Compare:\n| Op | Meaning |\n|---|---|");
  assert.equal(healStreaming("| Op | Meaning |\n|---|---|\n| ∪ | join |"), "| Op | Meaning |\n|---|---|\n| ∪ | join |");
  assert.equal(healStreaming("Text, no table."), "Text, no table.");
});

test("a table written on one line is split back into rows", () => {
  assert.equal(
    fixInlineTables("**Answer** | Op | Meaning | |---|---| | Union | join | | Inter | both |"),
    "**Answer**\n\n| Op | Meaning |\n|---|---|\n| Union | join |\n| Inter | both |",
  );
  const ok = "| Op | Meaning |\n|---|---|\n| Union | join |";
  assert.equal(fixInlineTables(ok), ok);
  assert.equal(fixInlineTables("A | B, not a table."), "A | B, not a table.");
});
