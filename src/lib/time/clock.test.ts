import { test } from "node:test";
import assert from "node:assert/strict";
import { addisParts, ethiopianHour, ethiopianPeriod, formatTime, parseAddisLocal, timeToMinutes } from "./clock.ts";

test("Ethiopian clock examples from the spec", () => {
  assert.equal(formatTime(8, 30, "eth"), "2:30 ጠዋት");
  assert.equal(formatTime(12, 25, "eth"), "6:25 ከሰዓት");
  assert.equal(formatTime(14, 30, "eth"), "8:30 ከሰዓት");
  assert.equal(formatTime(17, 25, "eth"), "11:25 ከሰዓት");
  assert.equal(formatTime(7, 0, "eth"), "1:00 ጠዋት");
});

test("Ethiopian hour: (h − 6) mod 12, 0 → 12", () => {
  const expected = [6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5];
  for (let h = 0; h < 24; h++) assert.equal(ethiopianHour(h), expected[h], `hour ${h}`);
});

test("Ethiopian time of day boundaries", () => {
  assert.equal(ethiopianPeriod(5), "night");
  assert.equal(ethiopianPeriod(6), "morning");
  assert.equal(ethiopianPeriod(11), "morning");
  assert.equal(ethiopianPeriod(12), "afternoon");
  assert.equal(ethiopianPeriod(17), "afternoon");
  assert.equal(ethiopianPeriod(18), "evening");
  assert.equal(ethiopianPeriod(23), "evening");
  assert.equal(ethiopianPeriod(0), "night");
  assert.equal(formatTime(6, 0, "eth"), "12:00 ጠዋት");
  assert.equal(formatTime(18, 0, "eth"), "12:00 ማታ");
  assert.equal(formatTime(0, 0, "eth"), "6:00 ሌሊት");
  assert.equal(formatTime(5, 59, "eth"), "11:59 ሌሊት");
});

test("12-hour and 24-hour", () => {
  assert.equal(formatTime(14, 30, "12h"), "2:30 PM");
  assert.equal(formatTime(0, 5, "12h"), "12:05 AM");
  assert.equal(formatTime(12, 0, "12h"), "12:00 PM");
  assert.equal(formatTime(8, 30, "12h"), "8:30 AM");
  assert.equal(formatTime(14, 30, "24h"), "14:30");
  assert.equal(formatTime(8, 5, "24h"), "08:05");
  assert.equal(formatTime(14, 30, "24h", 7), "14:30:07");
});

test("now is always Addis Ababa time (UTC+3), whatever the device zone", () => {
  // 11:45 UTC = 14:45 in Addis Ababa, Wednesday 11 Nov 2026
  const p = addisParts(Date.UTC(2026, 10, 11, 11, 45, 0));
  assert.equal(p.hour, 14);
  assert.equal(p.minute, 45);
  assert.equal(p.weekday, 3);
  assert.equal(p.day, 11);
  // 22:30 UTC on the 10th is already 01:30 on the 11th in Addis Ababa
  const late = addisParts(Date.UTC(2026, 10, 10, 22, 30));
  assert.equal(late.day, 11);
  assert.equal(late.hour, 1);
  assert.equal(late.weekday, 3);
  // Sunday is 7 (ISO)
  assert.equal(addisParts(Date.UTC(2026, 10, 15, 9, 0)).weekday, 7);
});

test("?now= parsing is Addis Ababa local time", () => {
  const ms = parseAddisLocal("2026-11-11T14:45");
  assert.equal(ms, Date.UTC(2026, 10, 11, 11, 45));
  const p = addisParts(ms!);
  assert.equal(`${p.hour}:${p.minute}`, "14:45");
  assert.equal(parseAddisLocal("2026-11-11T14:45:30"), Date.UTC(2026, 10, 11, 11, 45, 30));
  assert.equal(parseAddisLocal("nonsense"), null);
  assert.equal(parseAddisLocal("2026-13-01T10:00"), null);
});

test("Postgres time → minutes", () => {
  assert.equal(timeToMinutes("14:30:00"), 870);
  assert.equal(timeToMinutes("08:30"), 510);
});
