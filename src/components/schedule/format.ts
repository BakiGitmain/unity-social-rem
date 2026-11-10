import type { Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import { splitMinutes, type ClassEntry } from "@/lib/time/schedule";
import { formatEthiopianDateAm, gregorianToEthiopian } from "@/lib/time/ethiopian";
import type { AddisParts } from "@/lib/time/clock";

const DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_EN_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_AM = ["ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "ዓርብ", "ቅዳሜ", "እሑድ"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_AM = ["ጃንዩወሪ", "ፌብሩወሪ", "ማርች", "ኤፕሪል", "ሜይ", "ጁን", "ጁላይ", "ኦገስት", "ሴፕቴምበር", "ኦክቶበር", "ኖቬምበር", "ዲሴምበር"];

/** ISO weekday (1 = Monday) → name. */
export function dayName(day: number, locale: Locale, short = false): string {
  if (locale === "am") return DAYS_AM[day - 1];
  return (short ? DAYS_EN_SHORT : DAYS_EN)[day - 1];
}

/** "Tuesday, 10 November 2026" / "ማክሰኞ፣ ኖቬምበር 10, 2026" */
export function gregorianDate(p: AddisParts, locale: Locale): string {
  if (locale === "am") return `${DAYS_AM[p.weekday - 1]}፣ ${MONTHS_AM[p.month - 1]} ${p.day}, ${p.year}`;
  return `${DAYS_EN[p.weekday - 1]}, ${p.day} ${MONTHS_EN[p.month - 1]} ${p.year}`;
}

/** "ኅዳር 1, 2019 ዓ.ም" */
export function ethiopianDate(p: AddisParts): string {
  return formatEthiopianDateAm(gregorianToEthiopian(p.year, p.month, p.day));
}

/** Countdown text: "23 min", "1h 05m", "2h". */
export function duration(minutes: number, locale: Locale): string {
  const { h, m } = splitMinutes(minutes);
  if (h === 0) return t(locale, "durM", { m });
  if (m === 0) return t(locale, "durH", { h });
  return t(locale, "durHM", { h, m: String(m).padStart(2, "0") });
}

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

export function floorText(floor: number, locale: Locale): string {
  return t(locale, "floorN", { n: locale === "am" ? floor : ordinal(floor) });
}

export function periodsText(e: ClassEntry, locale: Locale): string {
  if (locale === "am") return e.periodStart === e.periodEnd ? `${e.periodStart}ኛ` : `${e.periodStart}ኛ–${e.periodEnd}ኛ`;
  return e.periodLabel || `${ordinal(e.periodStart)}–${ordinal(e.periodEnd)}`;
}

export const subjectName = (e: ClassEntry, locale: Locale) => (locale === "am" ? e.subjectAm : e.subjectEn);
export const roomName = (e: ClassEntry, locale: Locale) => (locale === "am" ? e.roomAm : e.roomEn);

/** Period reference (minutes since midnight). */
export const PERIODS = [
  { n: 1, start: 510, end: 565 },
  { n: 2, start: 570, end: 625 },
  { n: 3, start: 630, end: 685 },
  { n: 4, start: 690, end: 745 },
  { n: 5, start: 810, end: 865 },
  { n: 6, start: 870, end: 925 },
  { n: 7, start: 930, end: 985 },
  { n: 8, start: 990, end: 1045 },
];
export const DAY_START = 510; // 8:30
export const DAY_END = 1050; // 17:30
