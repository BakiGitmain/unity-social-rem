/**
 * Site settings stored in the app_settings table (edited in /admin/settings and /admin/ai).
 * Public keys (site, maintenance, features) are readable by everyone; "ai" is admin-only.
 * This file is safe for the browser: types + defaults only.
 */
export type SiteSettings = {
  site: { name: string; logo_url: string | null; default_locale: "en" | "am" };
  maintenance: { enabled: boolean; message_en: string; message_am: string };
  features: { signups: boolean; ai_tutor: boolean; schedule: boolean; learn_mode: boolean };
  /** Notes limits (the database enforces them too). */
  notes: { max_boards: number; max_cards: number; image_mb: number; storage_mb: number };
};

export type AiSettings = {
  web_search: boolean;
  /** null = the OPENAI_MODEL env var */
  model: string | null;
  daily_messages: number;
  daily_searches: number;
  /** USD per 1M tokens */
  price_input: number;
  price_cached: number;
  price_output: number;
  /** USD per 1,000 web searches */
  price_search: number;
  /** USD per month; 0 = no budget */
  monthly_budget: number;
  /** Handwriting checks (Answer Paper): on/off, reads per user per day, "check my working" hints per day. */
  ink_enabled: boolean;
  ink_daily_checks: number;
  ink_daily_hints: number;
  /** null = the default prompt in src/lib/tutor/prompt.ts */
  system_prompt: string | null;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  site: { name: "Unity Social Rem", logo_url: null, default_locale: "en" },
  maintenance: { enabled: false, message_en: "", message_am: "" },
  features: { signups: true, ai_tutor: true, schedule: true, learn_mode: true },
  notes: { max_boards: 200, max_cards: 1000, image_mb: 2, storage_mb: 100 },
};

export const DEFAULT_AI: AiSettings = {
  web_search: true,
  model: null,
  daily_messages: 30,
  daily_searches: 3,
  price_input: 0.1,
  price_cached: 0.01,
  price_output: 0.5,
  price_search: 10,
  monthly_budget: 5,
  ink_enabled: true,
  ink_daily_checks: 60,
  ink_daily_hints: 5,
  system_prompt: null,
};

/** Rows from app_settings → settings with defaults filled in (unknown keys ignored). */
export function mergeSettings(rows: { key: string; value: unknown }[] | null | undefined): SiteSettings {
  const out: SiteSettings = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows ?? []) {
    if (r.key in out && r.value && typeof r.value === "object") {
      Object.assign(out[r.key as keyof SiteSettings], r.value);
    }
  }
  if (out.site.default_locale !== "am") out.site.default_locale = "en";
  return out;
}
