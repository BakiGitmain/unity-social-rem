import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleStatus, splitMinutes, weeklyStats, type ClassEntry } from "./schedule.ts";

const t = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const at = (hhmm: string) => t(hhmm) * 60; // seconds of day

let n = 0;
const e = (day: number, start: string, end: string, subject: string): ClassEntry => ({
  id: String(++n),
  day,
  start: t(start),
  end: t(end),
  periodLabel: "",
  periodStart: 1,
  periodEnd: 2,
  subject,
  subjectEn: subject,
  subjectAm: subject,
  roomEn: "Room",
  roomAm: "ክፍል",
  floor: 1,
});

// Social Science, Section 1
const WEEK: ClassEntry[] = [
  e(1, "14:30", "16:25", "geography"),
  e(2, "10:30", "12:25", "english"),
  e(2, "14:30", "16:25", "geography"),
  e(3, "08:30", "10:25", "mathematics"),
  e(3, "10:30", "12:25", "english"),
  e(3, "13:30", "16:25", "history"),
  e(5, "15:30", "17:25", "mathematics"),
];

test("during a class: countdown and progress", () => {
  const s = scheduleStatus(WEEK, 3, at("09:00"));
  assert.equal(s.kind, "class");
  if (s.kind !== "class") return;
  assert.equal(s.current.subject, "mathematics");
  assert.equal(s.minutesLeft, 85);
  assert.ok(Math.abs(s.progress - 30 / 115) < 1e-9);
  assert.equal(s.next?.entry.subject, "english");
  assert.equal(s.next?.startsIn, 90);
});

test("class start is inclusive, end is exclusive", () => {
  assert.equal(scheduleStatus(WEEK, 1, at("14:30")).kind, "class");
  const s = scheduleStatus(WEEK, 3, at("10:25"));
  assert.equal(s.kind, "break");
  if (s.kind === "break") assert.equal(s.next.startsIn, 5);
});

test("before the first class", () => {
  const s = scheduleStatus(WEEK, 3, at("07:45"));
  assert.equal(s.kind, "before");
  if (s.kind === "before") {
    assert.equal(s.next.entry.subject, "mathematics");
    assert.equal(s.next.startsIn, 45);
  }
});

test("lunch break on Wednesday", () => {
  const s = scheduleStatus(WEEK, 3, at("12:50"));
  assert.equal(s.kind, "break");
  if (s.kind === "break") {
    assert.equal(s.next.entry.subject, "history");
    assert.equal(s.next.startsIn, 40);
    assert.equal(s.next.daysAhead, 0);
  }
});

test("done for today → next class day", () => {
  const s = scheduleStatus(WEEK, 3, at("17:00"));
  assert.equal(s.kind, "done");
  assert.equal(s.next?.entry.subject, "mathematics");
  assert.equal(s.next?.entry.day, 5);
  assert.equal(s.next?.daysAhead, 2);
  // Friday evening → Monday geography
  const fri = scheduleStatus(WEEK, 5, at("18:00"));
  assert.equal(fri.kind, "done");
  assert.equal(fri.next?.entry.day, 1);
  assert.equal(fri.next?.daysAhead, 3);
});

test("rest days (Thu, Sat, Sun)", () => {
  const thu = scheduleStatus(WEEK, 4, at("10:00"));
  assert.equal(thu.kind, "rest");
  assert.equal(thu.next?.entry.day, 5);
  assert.equal(thu.next?.daysAhead, 1);
  assert.equal(thu.next?.startsIn, 1440 - 600 + t("15:30"));
  const sun = scheduleStatus(WEEK, 7, at("20:00"));
  assert.equal(sun.kind, "rest");
  assert.equal(sun.next?.entry.subject, "geography");
  assert.equal(sun.next?.daysAhead, 1);
});

test("countdown rounding never shows 0 while time is left", () => {
  assert.deepEqual(splitMinutes(0.2), { h: 0, m: 1 });
  assert.deepEqual(splitMinutes(65), { h: 1, m: 5 });
  assert.deepEqual(splitMinutes(64.5), { h: 1, m: 5 });
  assert.deepEqual(splitMinutes(0), { h: 0, m: 0 });
});

test("weekly stats", () => {
  const s = weeklyStats(WEEK);
  assert.equal(s.classes, 7);
  assert.equal(s.busiest?.day, 3); // Wednesday: 115 + 115 + 175 min
  assert.equal(s.busiest?.minutes, 405);
  const geo = s.subjects.find((x) => x.entry.subject === "geography");
  assert.equal(geo?.minutes, 230);
  assert.equal(geo?.classes, 2);
});
