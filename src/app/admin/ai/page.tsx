import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAiStats, getFeedback, parseRange } from "@/lib/admin/queries";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/tutor/prompt";
import { DEFAULT_AI, type AiSettings } from "@/lib/settings";
import { AiControl } from "@/components/admin/pages/ai-control";

export const metadata: Metadata = { title: "AI tutor" };

export default async function AiPage({ searchParams }: PageProps<"/admin/ai">) {
  const ctx = await requireAdmin().catch(() => notFound());
  const days = parseRange((await searchParams).range);
  const sb = ctx.supabase;
  const [settings, stats, feedback, moderation, versions, spend] = await Promise.all([
    sb.from("app_settings").select("key, value").in("key", ["ai", "features"]),
    getAiStats(ctx, days),
    getFeedback(ctx, { limit: 300 }),
    sb.from("ai_moderation_log").select("id, user_id, message, categories, created_at, lessons(code, title_en)").order("created_at", { ascending: false }).limit(200),
    sb.from("ai_prompt_versions").select("id, prompt, created_at, created_by").order("created_at", { ascending: false }).limit(20),
    sb.rpc("admin_stats", { p_days: 1 }),
  ]);
  const ai = { ...DEFAULT_AI, ...((settings.data ?? []).find((r) => r.key === "ai")?.value as Partial<AiSettings> | undefined) };
  const features = (settings.data ?? []).find((r) => r.key === "features")?.value as { ai_tutor?: boolean } | undefined;
  const modIds = [...new Set((moderation.data ?? []).map((m) => m.user_id).filter(Boolean))] as string[];
  const { data: names } = modIds.length ? await sb.from("profiles").select("id, username").in("id", modIds) : { data: [] };
  const byId = new Map((names ?? []).map((n) => [n.id as string, n.username as string]));
  const s = spend.data as { ai_cost_month: number; ai_cost_today: number; ai_budget: number } | null;

  return (
    <AiControl
      days={days}
      settings={ai}
      enabled={features?.ai_tutor !== false}
      envModel={process.env.OPENAI_MODEL || "gpt-6-luna"}
      defaultPrompt={DEFAULT_SYSTEM_PROMPT}
      stats={stats}
      monthSpend={Number(s?.ai_cost_month ?? 0)}
      feedback={feedback}
      moderation={(moderation.data ?? []).map((m) => {
        const l = m.lessons as unknown as { code: string; title_en: string } | null;
        return {
          id: m.id as number,
          username: m.user_id ? byId.get(m.user_id as string) ?? null : null,
          user_id: m.user_id as string | null,
          message: m.message as string,
          categories: (m.categories as string[]) ?? [],
          created_at: m.created_at as string,
          lesson: l ? `${l.code} ${l.title_en}` : null,
        };
      })}
      versions={(versions.data ?? []).map((v) => ({ id: v.id as number, prompt: v.prompt as string | null, created_at: v.created_at as string }))}
    />
  );
}
