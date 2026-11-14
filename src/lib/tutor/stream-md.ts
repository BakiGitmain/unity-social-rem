/**
 * Markdown that is still streaming in is often cut in the middle of a mark: "the **main id", "see [the map](htt",
 * "$x^". Rendered as is, the raw ** / [ / $ flash on screen until the closing mark arrives. `healStreaming()` makes
 * the partial text well-formed for display only (the stored answer is never changed):
 *  - a mark that has just started with nothing after it yet is dropped ("text **" → "text"),
 *  - an open **bold**, *italic*, `code` or ``` block is closed,
 *  - an unfinished $math$ is hidden until it is complete (half a formula can't be drawn),
 *  - an unfinished link shows just its text,
 *  - a table appears only once its header line is complete (no raw "| a | b" flashing), and a half-written
 *    table row waits for its end, so the table does not jump while it grows.
 * Pure (tested in stream-md.test.ts).
 */
export function healStreaming(input: string): string {
  let s = holdTables(input);

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

/** Tables while streaming: hide a half-written row, and the whole table until its "|---|" line has arrived. */
function holdTables(input: string): string {
  const lines = input.split("\n");
  const isRow = (l: string) => l.trimStart().startsWith("|");
  const isSep = (l: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
  // the last line is a table row that has not reached its closing "|" yet
  const last = lines[lines.length - 1] ?? "";
  if (isRow(last) && !last.trimEnd().endsWith("|")) lines.pop();
  // the table at the end has no separator line yet: it is still just text, so wait for it
  let start = lines.length;
  while (start > 0 && isRow(lines[start - 1]!)) start--;
  if (start < lines.length && !lines.slice(start).some(isSep)) lines.length = start;
  return lines.join("\n");
}

/**
 * The model sometimes writes a whole table on ONE line ("| a | b | |---|---| | 1 | 2 |"), which Markdown can't
 * read as a table. Split such a line back into rows: wherever a row ends ("|") and the next begins ("|").
 * Only lines that contain a separator ("|---|") are touched. Pure (tested).
 */
export function fixInlineTables(input: string): string {
  return input
    .split("\n")
    .map((line) => {
      if (!/\|\s*:?-{3,}:?\s*\|/.test(line) || (line.match(/\|/g) ?? []).length < 6) return line;
      const start = line.indexOf("|");
      const before = line.slice(0, start).trim();
      const table = line.slice(start).replace(/\|\s+\|(?=\s*(:?-{3,}|[^|\s-]))/g, "|\n|");
      return before ? `${before}\n\n${table}` : table;
    })
    .join("\n");
}
