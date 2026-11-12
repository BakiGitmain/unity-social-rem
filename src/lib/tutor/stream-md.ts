/**
 * Markdown that is still streaming in is often cut in the middle of a mark: "the **main id", "see [the map](htt",
 * "$x^". Rendered as is, the raw ** / [ / $ flash on screen until the closing mark arrives. `healStreaming()` makes
 * the partial text well-formed for display only (the stored answer is never changed):
 *  - a mark that has just started with nothing after it yet is dropped ("text **" → "text"),
 *  - an open **bold**, *italic*, `code` or ``` block is closed,
 *  - an unfinished $math$ is hidden until it is complete (half a formula can't be drawn),
 *  - an unfinished link shows just its text.
 * Pure (tested in stream-md.test.ts).
 */
export function healStreaming(input: string): string {
  let s = input;

  // a code block that is still open: close it, nothing else inside it is Markdown
  const fences = (s.match(/^```/gm) ?? []).length;
  if (fences % 2 === 1) return `${s}\n\`\`\``;

  // unfinished link at the end: "[text](http…" or "[text" → "text"
  s = s.replace(/\[([^\]\n]*)\]\([^)\n]*$/, "$1").replace(/\[([^\]\n]*)$/, "$1");

  // a mark that has only just started ("… **", "… $", "… `")
  s = s.replace(/(^|\s)(\*{1,3}|_{1,2}|`|\$\$?)$/, "$1");

  // unfinished math: hide it from its opening $ until the closing $ arrives
  const dollars = [...s.matchAll(/(?<!\\)\$/g)].map((m) => m.index!);
  if (dollars.length % 2 === 1) s = s.slice(0, dollars[dollars.length - 1]);

  // inline code (outside code blocks)
  if ((s.match(/`/g) ?? []).length % 2 === 1) s = `${s.trimEnd()}\``;

  // bold, then single-star italic (list bullets "* item" at a line start don't count)
  if ((s.match(/\*\*/g) ?? []).length % 2 === 1) s = `${s.trimEnd()}**`;
  const singles = s.replace(/\*\*/g, "").replace(/^\s*\*\s/gm, "");
  if ((singles.match(/\*/g) ?? []).length % 2 === 1) s = `${s.trimEnd()}*`;

  return s;
}
