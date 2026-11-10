/**
 * What is happening in the timetable right now: current class, next class, break, done, rest day.
 * Pure functions, no dependencies (tested in schedule.test.ts).
 */

export type ClassEntry = {
  id: string;
  day: number; // ISO weekday 1-7
  start: number; // minutes since midnight (Addis Ababa)
  end: number;
  periodLabel: string;
  periodStart: number;
  periodEnd: number;
  subject: string; // subject slug
  subjectEn: string;
  subjectAm: string;
  roomEn: string;
  roomAm: string;
  floor: number;
};

export type Upcoming = {
  entry: ClassEntry;
  /** 0 = later today, 1 = tomorrow, ... */
  daysAhead: number;
  /** minutes from now until it starts (may have a fraction) */
  startsIn: number;
};

export type ScheduleStatus =
  | { kind: "class"; current: ClassEntry; minutesLeft: number; progress: number; next: Upcoming | null }
  | { kind: "before"; next: Upcoming } // classes today, the first hasn't started
  | { kind: "break"; next: Upcoming } // between two classes today
  | { kind: "done"; next: Upcoming | null } // today's classes are over
  | { kind: "rest"; next: Upcoming | null }; // no classes today

export function entriesForDay(entries: ClassEntry[], day: number): ClassEntry[] {
  return entries.filter((e) => e.day === day).sort((a, b) => a.start - b.start);
}

/** The first class after today, searching up to a week ahead. */
export function nextClassAfterToday(entries: ClassEntry[], weekday: number, nowMin: number): Upcoming | null {
  for (let k = 1; k <= 7; k++) {
    const day = ((weekday - 1 + k) % 7) + 1;
    const first = entriesForDay(entries, day)[0];
    if (first) return { entry: first, daysAhead: k, startsIn: k * 1440 + first.start - nowMin };
  }
  return null;
}

/**
 * @param weekday ISO weekday in Addis Ababa (1 = Monday)
 * @param secondOfDay seconds since midnight in Addis Ababa
 */
export function scheduleStatus(entries: ClassEntry[], weekday: number, secondOfDay: number): ScheduleStatus {
  const nowMin = secondOfDay / 60;
  const today = entriesForDay(entries, weekday);
  const laterToday = today.find((e) => e.start > nowMin);
  const nextUp: Upcoming | null = laterToday
    ? { entry: laterToday, daysAhead: 0, startsIn: laterToday.start - nowMin }
    : nextClassAfterToday(entries, weekday, nowMin);

  const current = today.find((e) => e.start <= nowMin && nowMin < e.end);
  if (current) {
    const length = current.end - current.start;
    return {
      kind: "class",
      current,
      minutesLeft: current.end - nowMin,
      progress: Math.min(1, Math.max(0, (nowMin - current.start) / length)),
      next: nextUp,
    };
  }
  if (today.length === 0) return { kind: "rest", next: nextUp };
  if (nowMin < today[0].start) return { kind: "before", next: nextUp! };
  if (laterToday) return { kind: "break", next: nextUp! };
  return { kind: "done", next: nextUp };
}

/** Minutes → { h, m } rounded UP to the next whole minute (a countdown never shows 0 while time is left). */
export function splitMinutes(minutes: number): { h: number; m: number } {
  const total = Math.max(0, Math.ceil(minutes - 1e-9));
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** Weekly totals: minutes per subject, number of classes, busiest day. */
export function weeklyStats(entries: ClassEntry[]) {
  const perSubject = new Map<string, { minutes: number; classes: number; entry: ClassEntry }>();
  const perDay = new Map<number, number>();
  for (const e of entries) {
    const len = e.end - e.start;
    const s = perSubject.get(e.subject) ?? { minutes: 0, classes: 0, entry: e };
    s.minutes += len;
    s.classes += 1;
    perSubject.set(e.subject, s);
    perDay.set(e.day, (perDay.get(e.day) ?? 0) + len);
  }
  let busiest: { day: number; minutes: number } | null = null;
  for (const [day, minutes] of perDay) if (!busiest || minutes > busiest.minutes) busiest = { day, minutes };
  return {
    subjects: [...perSubject.values()].sort((a, b) => b.minutes - a.minutes),
    classes: entries.length,
    totalMinutes: entries.reduce((n, e) => n + e.end - e.start, 0),
    busiest,
  };
}
