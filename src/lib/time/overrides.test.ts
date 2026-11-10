import { test } from "node:test";
import assert from "node:assert/strict";
import type { ClassEntry } from "./schedule.ts";
import { addDays, planForDate, scheduleStatusOn, weekdayOf, type ScheduleOverride } from "./overrides.ts";

const t = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};
const at = (hhmm: string) => t(hhmm) * 60;

let n = 0;
const e = (day: number, start: string, end: string, subject: string): ClassEntry => ({
  id: `e${++n}`,
  day,
  start: t(start),
  end: t(end),
  periodLabel: "",
  periodStart: 1,
  periodEnd: 2,
  subject,
  subjectEn: subject,
  subjectAm: subject,
  roomEn: "Room 12",
  roomAm: "ክፍል 12",
  floor: 1,
});

const WEEK: ClassEntry[] = [
  e(1, "08:30", "09:30", "geography"),
  e(1, "14:30", "16:25", "history"),
  e(2, "10:00", "11:00", "english"),
];

const ov = (o: Partial<ScheduleOverride> & Pick<ScheduleOverride, "id" | "date" | "kind">): ScheduleOverride => ({
  entryId: null,
  subject: null,
  subjectEn: null,
  subjectAm: null,
  start: null,
  end: null,
  roomEn: null,
  roomAm: null,
  floor: null,
  titleEn: null,
  titleAm: null,
  noteEn: null,
  noteAm: null,
  ...o,
});

// 2026-11-09 is a Monday.
test("dates: addDays crosses months/years, weekdayOf", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(weekdayOf("2026-11-09"), 1);
  assert.equal(weekdayOf("2026-11-15"), 7);
});

test("a cancelled class is shown (marked) but skipped for now / next", () => {
  const overrides = [ov({ id: "c", date: "2026-11-09", kind: "cancel", entryId: "e1" })];
  const plan = planForDate(WEEK, overrides, "2026-11-09", 1);
  assert.equal(plan.classes.find((c) => c.id === "e1")?.status, "cancelled");
  assert.equal(plan.active.some((c) => c.id === "e1"), false);
  const s = scheduleStatusOn(WEEK, overrides, "2026-11-09", 1, at("08:45"));
  // The first class is gone, so the day now starts with history.
  assert.equal(s.kind, "before");
  assert.equal(s.next?.entry.id, "e2");
  // Without the override it would be the geography class.
  const normal = scheduleStatusOn(WEEK, [], "2026-11-09", 1, at("08:45"));
  assert.equal(normal.kind === "class" && normal.current.id, "e1");
});

test("room change replaces the room and keeps the old one", () => {
  const plan = planForDate(WEEK, [ov({ id: "r", date: "2026-11-09", kind: "room", entryId: "e1", roomEn: "Lab 2", floor: 3 })], "2026-11-09", 1);
  const c = plan.classes.find((x) => x.id === "e1")!;
  assert.equal(c.status, "room_changed");
  assert.equal(c.roomEn, "Lab 2");
  assert.equal(c.roomAm, "Lab 2");
  assert.equal(c.floor, 3);
  assert.equal(c.originalRoomEn, "Room 12");
});

test("overrides only apply on their own date", () => {
  const overrides = [ov({ id: "c", date: "2026-11-16", kind: "cancel", entryId: "e1" })];
  assert.equal(planForDate(WEEK, overrides, "2026-11-09", 1).active.length, 2);
  assert.equal(planForDate(WEEK, overrides, "2026-11-16", 1).active.length, 1);
});

test("a holiday clears the day; extra class and exam are added in time order", () => {
  const hol = planForDate(WEEK, [ov({ id: "h", date: "2026-11-09", kind: "holiday", titleEn: "Holiday" })], "2026-11-09", 1);
  assert.equal(hol.classes.length, 0);
  assert.equal(hol.holiday?.titleEn, "Holiday");
  const plan = planForDate(
    WEEK,
    [
      ov({ id: "x", date: "2026-11-15", kind: "extra", subject: "history", subjectEn: "History", start: t("09:00"), end: t("10:00") }),
      ov({ id: "x2", date: "2026-11-15", kind: "exam", titleEn: "Geography exam", start: t("08:30"), end: t("08:50") }),
    ],
    "2026-11-15",
    7,
  );
  assert.deepEqual(
    plan.classes.map((c) => c.status),
    ["exam", "extra"],
  );
  assert.equal(plan.classes[0]!.subjectEn, "Geography exam");
});

test("an extra class on a rest day becomes the current class", () => {
  const overrides = [ov({ id: "x", date: "2026-11-15", kind: "extra", subject: "history", start: t("09:00"), end: t("10:00") })];
  const s = scheduleStatusOn(WEEK, overrides, "2026-11-15", 7, at("09:30"));
  assert.equal(s.kind, "class");
});

test("next class skips a holiday tomorrow", () => {
  // Sunday evening; Monday is a holiday → the next class is Tuesday's English.
  const s = scheduleStatusOn(WEEK, [ov({ id: "h", date: "2026-11-16", kind: "holiday" })], "2026-11-15", 7, at("20:00"));
  assert.equal(s.kind, "rest");
  assert.equal(s.next?.daysAhead, 2);
  assert.equal(s.next?.entry.subject, "english");
});
