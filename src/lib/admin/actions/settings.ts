"use server";

import { adminAction, fail } from "@/lib/admin/action";
import { saveSetting } from "@/lib/admin/settings-store";
import type { AiSettings, SiteSettings } from "@/lib/settings";

const num = (v: unknown, min: number, max: number, label: string) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) fail(`${label} must be between ${min} and ${max}`);
  return n;
};

/* ---------------- AI tutor ---------------- */

export async function saveAiSettings(input: Omit<AiSettings, "system_prompt"> & { enabled: boolean }) {
  return adminAction(async (ctx) => {
    const model = input.model?.trim() || null;
    if (model !== null && !/^[a-z0-9][a-z0-9.\-_:]{1,60}$/i.test(model)) fail("Model name looks wrong (e.g. gpt-6-luna)");
    const next = {
      web_search: !!input.web_search,
      model,
      daily_messages: Math.round(num(input.daily_messages, 0, 1000, "Daily messages")),
      daily_searches: Math.round(num(input.daily_searches, 0, 50, "Daily searches")),
      price_input: num(input.price_input, 0, 1000, "Input price"),
      price_cached: num(input.price_cached, 0, 1000, "Cached input price"),
      price_output: num(input.price_output, 0, 1000, "Output price"),
      price_search: num(input.price_search, 0, 1000, "Search price"),
      monthly_budget: num(input.monthly_budget, 0, 100000, "Monthly budget"),
      ink_enabled: input.ink_enabled !== false,
      ink_daily_checks: Math.round(num(input.ink_daily_checks ?? 60, 0, 500, "Handwriting checks")),
      ink_daily_hints: Math.round(num(input.ink_daily_hints ?? 5, 0, 50, "Working hints")),
    };
    await saveSetting(ctx, "ai", (v) => ({ ...v, ...next }));
    await saveSetting(ctx, "features", (v) => ({ ...v, ai_tutor: !!input.enabled }), input.enabled ? "ai.enable" : "ai.disable");
    return null;
  });
}

/** Save a new system prompt (null = back to the default). Every save is kept in ai_prompt_versions. */
export async function saveSystemPrompt(prompt: string | null) {
  return adminAction(async (ctx) => {
    const p = prompt === null ? null : String(prompt);
    if (p !== null && (p.trim().length < 50 || p.length > 20000)) fail("The prompt must be 50–20,000 characters");
    const { error } = await ctx.supabase.from("ai_prompt_versions").insert({ prompt: p, created_by: ctx.userId });
    if (error) fail("Could not save the prompt version");
    await saveSetting(ctx, "ai", (v) => ({ ...v, system_prompt: p }), p === null ? "ai.prompt_reset" : "ai.prompt_update");
    return null;
  });
}

export async function markFeedbackReviewed(ids: number[], reviewed: boolean) {
  return adminAction(async (ctx) => {
    if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((x) => Number.isInteger(x))) fail("Invalid feedback");
    const { error } = await ctx.supabase
      .from("ai_feedback")
      .update({ reviewed_at: reviewed ? new Date().toISOString() : null, reviewed_by: reviewed ? ctx.userId : null })
      .in("id", ids);
    if (error) fail("Could not update the feedback");
    await ctx.audit(reviewed ? "ai.feedback_reviewed" : "ai.feedback_unreviewed", "ai_feedback", ids.join(",").slice(0, 200), null, { count: ids.length });
    return null;
  });
}

/* ---------------- site settings ---------------- */

export async function saveSiteSettings(input: SiteSettings["site"]) {
  return adminAction(async (ctx) => {
    const name = String(input.name ?? "").trim();
    if (!name || name.length > 60) fail("Site name: 1–60 characters");
    const logo = input.logo_url?.trim() || null;
    if (logo !== null && !(/^https:\/\//.test(logo) || /^\/[\w\-./]+$/.test(logo))) fail("Logo must be an https URL or a /public path");
    if (input.default_locale !== "en" && input.default_locale !== "am") fail("Invalid language");
    await saveSetting(ctx, "site", () => ({ name, logo_url: logo, default_locale: input.default_locale }));
    return null;
  });
}

/** Notes limits: boards per student, cards per board, image size, image storage per student. */
export async function saveNotesLimits(input: SiteSettings["notes"]) {
  return adminAction(async (ctx) => {
    const next = {
      max_boards: Math.round(num(input.max_boards, 1, 5000, "Boards per student")),
      max_cards: Math.round(num(input.max_cards, 10, 20000, "Cards per board")),
      image_mb: num(input.image_mb, 0.5, 2, "Image size (MB)"),
      storage_mb: Math.round(num(input.storage_mb, 1, 2000, "Image storage (MB)")),
    };
    await saveSetting(ctx, "notes", () => next, "notes.limits");
    return null;
  });
}

export async function saveFeatures(input: SiteSettings["features"]) {
  return adminAction(async (ctx) => {
    const next = { signups: !!input.signups, ai_tutor: !!input.ai_tutor, schedule: !!input.schedule, learn_mode: !!input.learn_mode };
    await saveSetting(ctx, "features", () => next);
    return null;
  });
}

/** Maintenance mode is "dangerous": the UI asks to type "maintenance" first. */
export async function saveMaintenance(input: SiteSettings["maintenance"]) {
  return adminAction(async (ctx) => {
    const m = { enabled: !!input.enabled, message_en: String(input.message_en ?? "").slice(0, 400), message_am: String(input.message_am ?? "").slice(0, 400) };
    await saveSetting(ctx, "maintenance", () => m, m.enabled ? "maintenance.on" : "maintenance.off");
    return null;
  });
}
