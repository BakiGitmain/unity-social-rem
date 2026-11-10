/**
 * Date overrides for the class schedule (Admin → Schedule): cancel a class, room change, extra class,
 * exam, holiday. Pure functions, no dependencies (tested in overrides.test.ts).
 */
import { entriesForDay, type ClassEntry, type ScheduleStatus, type Upcoming } from "./schedule.ts";

export type OverrideKind = "cancel" | "extra" | "room" | "holiday" | "exam";

/** One change on one date (Addis Ababa), from the schedule_overrides table. Times in minutes. */
export type ScheduleOverride = {
  id: string;
  date: string; // YYYY-MM-DD
  kind: OverrideKind;
  entryId: string | null;
  subject: string | null;
  subjectEn: string | null;
  subjectAm: string | null;
  start: number | null;
  end: number | null;
  roomEn: string | null;
  roomAm: string | null;
  floor: number | null;
  titleEn: string | null;
  titleAm: string | null;
  noteEn: string | null;
  noteAm: string | null;
};

export type DayClass = ClassEntry & {
  status?: "cancelled" | "room_changed" | "extra" | "exam";
  originalRoomEn?: string;
  originalRoomAm?: string;
  noteEn?: string | null;
  noteAm?: string | null;
};

export type DayPlan = {
  /** Everything to show that day, sorted (cancelled classes included, marked). */
  classes: DayClass[];
  /** Classes that really happen (no cancelled ones). Used for "now / next". */
  active: DayClass[];
  holiday: ScheduleOverride | null;
};

/** "2026-11-10" + k days → "2026-11-12" (pure calendar arithmetic, no time zones). */
export function addDays(date: string, k: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + k)).toISOString().slice(0, 10);
}

export function isoDate(p: { year: number; month: number; day: number }): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** ISO weekday (1 = Monday) of a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const js = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return js === 0 ? 7 : js;
}

/** The timetable of one date with its overrides applied. */
export function planForDate(entries: ClassEntry[], overrides: ScheduleOverride[], date: string, weekday: number): DayPlan {
  const today = overrides.filter((o) => o.date === date);
  const holiday = today.find((o) => o.kind === "holiday") ?? null;
  if (holiday) return { classes: [], active: [], holiday };

  const classes: DayClass[] = entriesForDay(entries, weekday).map((e) => {
    const cancel = today.find((o) => o.kind === "cancel" && o.entryId === e.id);
    if (cancel) return { ...e, status: "cancelled", noteEn: cancel.noteEn, noteAm: cancel.noteAm };
    const room = today.find((o) => o.kind === "room" && o.entryId === e.id);
    if (room) {
      return {
        ...e,
        status: "room_changed",
        originalRoomEn: e.roomEn,
        originalRoomAm: e.roomAm,
        roomEn: room.roomEn || e.roomEn,
        roomAm: room.roomAm || room.roomEn || e.roomAm,
        floor: room.floor ?? e.floor,
        noteEn: room.noteEn,
        noteAm: room.noteAm,
      };
    }
    return e;
  });

  for (const o of today) {
    if ((o.kind !== "extra" && o.kind !== "exam") || o.start === null || o.end === null) continue;
    const name = o.titleEn || o.subjectEn || o.subject || (o.kind === "exam" ? "Exam" : "Class");
    classes.push({
      id: `override-${o.id}`,
      day: weekday,
      start: o.start,
      end: o.end,
      periodLabel: "",
      periodStart: 0,
      periodEnd: 0,
      subject: o.subject ?? "",
      subjectEn: name,
      subjectAm: o.titleAm || o.subjectAm || name,
      roomEn: o.roomEn ?? "",
      roomAm: o.roomAm || o.roomEn || "",
      floor: o.floor ?? 0,
      status: o.kind,
      noteEn: o.noteEn,
      noteAm: o.noteAm,
    });
  }
  classes.sort((a, b) => a.start - b.start);
  return { classes, active: classes.filter((c) => c.status !== "cancelled"), holiday: null };
}

/**
 * Like scheduleStatus, but with overrides: "now / next" skips cancelled classes and holidays and includes
 * extra classes, exams and room changes. `today` is the Addis Ababa date matching `weekday`.
 */
export function scheduleStatusOn(
  entries: ClassEntry[],
  overrides: ScheduleOverride[],
  today: string,
  weekday: number,
  secondOfDay: number,
): ScheduleStatus & { plan: DayPlan } {
  const plan = planForDate(entries, overrides, today, weekday);
  const nowMin = secondOfDay / 60;
  const todays = plan.active;
  const laterToday = todays.find((e) => e.start > nowMin);

  let next: Upcoming | null = laterToday ? { entry: laterToday, daysAhead: 0, startsIn: laterToday.start - nowMin } : null;
  for (let k = 1; k <= 14 && !next; k++) {
    const first = planForDate(entries, overrides, addDays(today, k), ((weekday - 1 + k) % 7) + 1).active[0];
    if (first) next = { entry: first, daysAhead: k, startsIn: k * 1440 + first.start - nowMin };
  }

  const current = todays.find((e) => e.start <= nowMin && nowMin < e.end);
  if (current) {
    return {
      kind: "class",
      current,
      minutesLeft: current.end - nowMin,
      progress: Math.min(1, Math.max(0, (nowMin - current.start) / (current.end - current.start))),
      next,
      plan,
    };
  }
  if (todays.length === 0) return { kind: "rest", next, plan };
  if (nowMin < todays[0]!.start) return { kind: "before", next: next!, plan };
  if (laterToday) return { kind: "break", next: next!, plan };
  return { kind: "done", next, plan };
}
