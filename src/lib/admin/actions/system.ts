"use server";

import { adminAction } from "@/lib/admin/action";
import { createPublicClient } from "@/lib/supabase/public";

/** Env vars the app needs. Only presence is reported (✅/❌), NEVER the values. */
const ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
] as const;

async function timed<T>(fn: () => Promise<T>) {
  const t = Date.now();
  try {
    const ok = await fn();
    return { ok: !!ok, ms: Date.now() - t };
  } catch {
    return { ok: false, ms: Date.now() - t };
  }
}

/** Health checks. OpenAI is checked with GET /v1/models (free, no chat). */
export async function healthCheck() {
  return adminAction(async (ctx) => {
    const [supabase, openai] = await Promise.all([
      timed(async () => {
        const { error } = await createPublicClient().from("app_settings").select("key", { head: true, count: "exact" });
        return !error;
      }),
      timed(async () => {
        if (!process.env.OPENAI_API_KEY) return false;
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });
        return res.ok;
      }),
    ]);
    await ctx.audit("system.health_check", "system", null, null, { supabase: supabase.ok, openai: openai.ok });
    return {
      supabase,
      openai,
      env: ENV_VARS.map((name) => ({ name, present: !!process.env[name] })),
      checkedAt: new Date().toISOString(),
    };
  }, { revalidate: false });
}
