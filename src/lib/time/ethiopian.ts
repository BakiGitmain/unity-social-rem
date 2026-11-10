/**
 * Ethiopian (Ge'ez) calendar ⇄ Gregorian calendar, via Julian Day Numbers.
 * The Ethiopian year has 12 months of 30 days plus Pagume (5 days, 6 in the year before a Gregorian leap year).
 * Pure functions, no dependencies (tested in ethiopian.test.ts).
 */

/** Julian Day Number of 1 Meskerem 1 (Amete Mihret era) minus one-year offset used by the standard algorithm. */
const ETHIOPIC_EPOCH = 1723856;

const mod = (a: number, b: number) => ((a % b) + b) % b;

export type YMD = { year: number; month: number; day: number };

/** Gregorian date → Julian Day Number. */
export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/** Julian Day Number → Gregorian date. */
export function jdnToGregorian(jdn: number): YMD {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

/** Julian Day Number → Ethiopian date. */
export function jdnToEthiopian(jdn: number): YMD {
  const r = mod(jdn - ETHIOPIC_EPOCH, 1461);
  const n = mod(r, 365) + 365 * Math.floor(r / 1460);
  return {
    year: 4 * Math.floor((jdn - ETHIOPIC_EPOCH) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: mod(n, 30) + 1,
  };
}

/** Ethiopian date → Julian Day Number. */
export function ethiopianToJdn(year: number, month: number, day: number): number {
  return ETHIOPIC_EPOCH + 365 + 365 * (year - 1) + Math.floor(year / 4) + 30 * month + day - 31;
}

export function gregorianToEthiopian(year: number, month: number, day: number): YMD {
  return jdnToEthiopian(gregorianToJdn(year, month, day));
}

export function ethiopianToGregorian(year: number, month: number, day: number): YMD {
  return jdnToGregorian(ethiopianToJdn(year, month, day));
}

export const ETHIOPIAN_MONTHS_AM = [
  "መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜ",
] as const;

export const ETHIOPIAN_MONTHS_EN = [
  "Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit", "Megabit", "Miyazya", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume",
] as const;

/** e.g. "ጥቅምት 30, 2019 ዓ.ም" */
export function formatEthiopianDateAm({ year, month, day }: YMD): string {
  return `${ETHIOPIAN_MONTHS_AM[month - 1]} ${day}, ${year} ዓ.ም`;
}
