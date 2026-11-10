/**
 * Addis Ababa time (EAT = UTC+3, no daylight saving) and the three clock formats.
 * "Now" is ALWAYS calculated in Addis Ababa time, whatever time zone the device uses.
 * Pure functions, no dependencies (tested in clock.test.ts).
 */

export const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

export type AddisParts = {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // ISO: 1 = Monday ... 7 = Sunday
  hour: number;
  minute: number;
  second: number;
  /** seconds since local midnight in Addis Ababa */
  secondOfDay: number;
};

/** Splits an instant (epoch ms) into Addis Ababa calendar/clock parts. */
export function addisParts(epochMs: number): AddisParts {
  const d = new Date(epochMs + ADDIS_OFFSET_MS);
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const second = d.getUTCSeconds();
  const js = d.getUTCDay();
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: js === 0 ? 7 : js,
    hour,
    minute,
    second,
    secondOfDay: hour * 3600 + minute * 60 + second,
  };
}

/** "2026-11-11T14:45" (or with :ss), read as Addis Ababa local time → epoch ms. null if invalid. */
export function parseAddisLocal(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => (x === undefined ? 0 : Number(x)));
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  return Date.UTC(y, mo - 1, d, h, mi, s) - ADDIS_OFFSET_MS;
}

export type TimeFormat = "12h" | "24h" | "eth";
export type EthPeriod = "morning" | "afternoon" | "evening" | "night";

/** Ethiopian clock: the day starts at 6:00 AM. eth = (hour24 − 6) mod 12, and 0 becomes 12. */
export function ethiopianHour(hour24: number): number {
  const h = (((hour24 - 6) % 12) + 12) % 12;
  return h === 0 ? 12 : h;
}

/** 06–11 morning (ጠዋት), 12–17 afternoon (ከሰዓት), 18–23 evening (ማታ), 00–05 night (ሌሊት). */
export function ethiopianPeriod(hour24: number): EthPeriod {
  if (hour24 >= 6 && hour24 < 12) return "morning";
  if (hour24 >= 12 && hour24 < 18) return "afternoon";
  if (hour24 >= 18) return "evening";
  return "night";
}

export const ETH_PERIOD_AM: Record<EthPeriod, string> = {
  morning: "ጠዋት",
  afternoon: "ከሰዓት",
  evening: "ማታ",
  night: "ሌሊት",
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Formats a clock time.
 *  12h → "2:30 PM"   24h → "14:30"   eth → "8:30 ከሰዓት"
 * Pass `second` to include seconds (live clock).
 */
export function formatTime(hour24: number, minute: number, format: TimeFormat, second?: number): string {
  const sec = second === undefined ? "" : `:${pad(second)}`;
  if (format === "24h") return `${pad(hour24)}:${pad(minute)}${sec}`;
  if (format === "eth") return `${ethiopianHour(hour24)}:${pad(minute)}${sec} ${ETH_PERIOD_AM[ethiopianPeriod(hour24)]}`;
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h12}:${pad(minute)}${sec} ${hour24 < 12 ? "AM" : "PM"}`;
}

/** Minutes since midnight → formatted time. */
export function formatMinutes(minuteOfDay: number, format: TimeFormat): string {
  return formatTime(Math.floor(minuteOfDay / 60) % 24, Math.round(minuteOfDay % 60), format);
}

/** "14:30:00" (Postgres time) → minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
