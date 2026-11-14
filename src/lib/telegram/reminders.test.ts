import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAddisLocal } from "../time/clock.ts";
import type { ScheduleOverride } from "../time/overrides.ts";
import type { ClassEntry } from "../time/schedule.ts";
import { REMIND_BEFORE_MIN, SUMMARY_KEY, planTick } from "./reminders.ts";

const min = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};
const entry = (id: string, day: number, start: string, end: string, subject = "geography"): ClassEntry => ({
  id,
  day,
  start: min(start),
  end: min(end),
  periodLabel: "",
  periodStart: 1,
  periodEnd: 2,
  subject,
  subjectEn: subject,
  subjectAm: subject,
  roomEn: "Room 12",
  roomAm: "ክፍል 12",
  floor: 2,
});
const override = (o: Partial<ScheduleOverride> & Pick<ScheduleOverride, "date" | "kind">): ScheduleOverride => ({
  id: "o1",
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
/** Addis Ababa local time → epoch ms. 2026-11-16 is a Monday. */
const at = (local: string) => parseAddisLocal(local)!;

// Monday: math 8:00-9:00, geography 14:30-16:25. Tuesday: english 10:30.
const WEEK = [entry("math-mon", 1, "08:00", "09:00", "mathematics"), entry("geo-mon", 1, "14:30", "16:25"), entry("eng-tue", 2, "10:30", "12:25", "english")];
const none = new Set<string>();

test("uses Addis Ababa time, not UTC: 07:45 Addis = 04:45 UTC", () => {
  const p = planTick(WEEK, [], Date.UTC(2026, 10, 16, 4, 45), none);
  assert.equal(p.date, "2026-11-16");
  assert.equal(p.weekday, 1);
  assert.equal(p.minuteOfDay, min("07:45"));
  assert.deepEqual(p.reminders.map((r) => r.key), ["math-mon"]);
});

test("a reminder is due exactly 15 minutes before, not 20", () => {
  assert.equal(REMIND_BEFORE_MIN, 15);
  assert.deepEqual(planTick(WEEK, [], at("2026-11-16T07:40"), none).reminders, []);
  const r = planTick(WEEK, [], at("2026-11-16T07:45"), none).reminders;
  assert.equal(r.length, 1);
  assert.equal(r[0]!.minutesUntil, 15);
  assert.equal(r[0]!.date, "2026-11-16");
});

test("a late tick (e.g. 7:50 or 7:55) still sends it; at or after the start it doesn't", () => {
  assert.equal(planTick(WEEK, [], at("2026-11-16T07:50"), none).reminders.length, 1);
  assert.equal(planTick(WEEK, [], at("2026-11-16T07:59"), none).reminders.length, 1);
  assert.equal(planTick(WEEK, [], at("2026-11-16T08:00"), none).reminders.length, 0);
  assert.equal(planTick(WEEK, [], at("2026-11-16T08:30"), none).reminders.length, 0);
});

test("a reminder already sent today is not sent again", () => {
  assert.deepEqual(planTick(WEEK, [], at("2026-11-16T07:50"), new Set(["math-mon"])).reminders, []);
});

test("afternoon class: 14:15 → reminder for the 14:30 geography class", () => {
  const r = planTick(WEEK, [], at("2026-11-16T14:15"), none).reminders;
  assert.deepEqual(r.map((x) => x.key), ["geo-mon"]);
});

test("the 7:00 summary: due from 7:00 until 8:00, once, only on days with classes", () => {
  assert.equal(planTick(WEEK, [], at("2026-11-16T06:55"), none).summary, null);
  const s = planTick(WEEK, [], at("2026-11-16T07:00"), none).summary;
  assert.equal(s?.key, SUMMARY_KEY);
  assert.equal(s?.plan.active.length, 2);
  assert.ok(planTick(WEEK, [], at("2026-11-16T07:55"), none).summary);
  assert.equal(planTick(WEEK, [], at("2026-11-16T08:00"), none).summary, null);
  assert.equal(planTick(WEEK, [], at("2026-11-16T07:05"), new Set([SUMMARY_KEY])).summary, null);
  // Wednesday: no classes → no summary
  assert.equal(planTick(WEEK, [], at("2026-11-18T07:00"), none).summary, null);
});

test("a cancelled class gets no reminder", () => {
  const ov = [override({ date: "2026-11-16", kind: "cancel", entryId: "math-mon" })];
  assert.deepEqual(planTick(WEEK, ov, at("2026-11-16T07:45"), none).reminders, []);
  assert.equal(planTick(WEEK, ov, at("2026-11-16T07:00"), none).summary?.plan.active.length, 1);
});

test("a room change shows the new room in the reminder", () => {
  const ov = [override({ date: "2026-11-16", kind: "room", entryId: "math-mon", roomEn: "Lab 3", roomAm: "ቤተ ሙከራ 3", floor: 1 })];
  const r = planTick(WEEK, ov, at("2026-11-16T07:45"), none).reminders[0]!;
  assert.equal(r.cls.roomEn, "Lab 3");
  assert.equal(r.cls.status, "room_changed");
  assert.equal(r.cls.originalRoomEn, "Room 12");
});

test("an extra class or exam gets a reminder; a holiday gets the summary but no reminders", () => {
  const extra = [override({ id: "x9", date: "2026-11-18", kind: "exam", start: min("09:00"), end: min("10:00"), titleEn: "Math test" })];
  const r = planTick(WEEK, extra, at("2026-11-18T08:45"), none).reminders;
  assert.deepEqual(r.map((x) => x.key), ["override-x9"]);
  assert.equal(r[0]!.cls.status, "exam");

  const holiday = [override({ date: "2026-11-16", kind: "holiday", titleEn: "Holiday" })];
  assert.deepEqual(planTick(WEEK, holiday, at("2026-11-16T07:45"), none).reminders, []);
  assert.ok(planTick(WEEK, holiday, at("2026-11-16T07:00"), none).summary?.plan.holiday);
});

test("near midnight UTC the Addis date is already the next day", () => {
  // 2026-11-16 21:30 UTC = 2026-11-17 00:30 Addis (Tuesday)
  const p = planTick(WEEK, [], Date.UTC(2026, 10, 16, 21, 30), none);
  assert.equal(p.date, "2026-11-17");
  assert.equal(p.weekday, 2);
});
