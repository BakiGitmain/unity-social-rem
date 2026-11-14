/**
 * What the 5-minute tick must send now: the 7:00 "today's classes" summary and the 15-minutes-before reminders.
 * Always Addis Ababa time (UTC+3), never the server's time zone. Pure functions (tested in reminders.test.ts).
 */
import { addisParts } from "../time/clock.ts";
import { isoDate, planForDate, type DayClass, type DayPlan, type ScheduleOverride } from "../time/overrides.ts";
import type { ClassEntry } from "../time/schedule.ts";

/** Minutes before a class when its reminder goes out. */
export const REMIND_BEFORE_MIN = 15;
/** The morning summary: from 7:00, at most until 8:00 (a late tick still sends it, a much later one doesn't). */
export const SUMMARY_FROM_MIN = 7 * 60;
export const SUMMARY_UNTIL_MIN = 8 * 60;
/** The key used in telegram_reminders_sent for the summary. */
export const SUMMARY_KEY = "summary";

export type ReminderDue = { key: string; date: string; cls: DayClass; minutesUntil: number };
export type SummaryDue = { key: string; date: string; plan: DayPlan; weekday: number };
export type TickPlan = { date: string; weekday: number; minuteOfDay: number; summary: SummaryDue | null; reminders: ReminderDue[] };

/**
 * @param sent keys already in telegram_reminders_sent for today, as `${class_id}` (the date is today's).
 */
export function planTick(entries: ClassEntry[], overrides: ScheduleOverride[], nowMs: number, sent: Set<string>): TickPlan {
  const p = addisParts(nowMs);
  const date = isoDate(p);
  const minuteOfDay = p.secondOfDay / 60;
  const plan = planForDate(entries, overrides, date, p.weekday);

  let summary: SummaryDue | null = null;
  const hasSomething = plan.active.length > 0 || plan.holiday !== null;
  if (hasSomething && minuteOfDay >= SUMMARY_FROM_MIN && minuteOfDay < SUMMARY_UNTIL_MIN && !sent.has(SUMMARY_KEY)) {
    summary = { key: SUMMARY_KEY, date, plan, weekday: p.weekday };
  }

  const reminders: ReminderDue[] = [];
  for (const cls of plan.active) {
    const minutesUntil = cls.start - minuteOfDay;
    if (minutesUntil > 0 && minutesUntil <= REMIND_BEFORE_MIN + 1e-9 && !sent.has(cls.id)) {
      reminders.push({ key: cls.id, date, cls, minutesUntil });
    }
  }
  return { date, weekday: p.weekday, minuteOfDay, summary, reminders };
}
