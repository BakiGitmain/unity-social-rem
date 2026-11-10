/** Site UI language (separate from the lesson-notes language toggle). */
export const LOCALES = ["en", "am"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "usr-site-lang";
export const LOCALE_STORAGE_KEY = "usr-site-lang";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Picks the `<field>_en` / `<field>_am` column of a DB row for the site language. */
export function loc<T extends Record<string, unknown>>(row: T, field: string, locale: Locale): string {
  const v = row[`${field}_${locale}`] ?? row[`${field}_en`];
  return typeof v === "string" ? v : "";
}
