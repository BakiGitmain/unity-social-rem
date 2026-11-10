import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { mergeSettings } from "@/lib/settings";
import { SiteSettingsAdmin } from "@/components/admin/pages/site-settings";

export const metadata: Metadata = { title: "Site settings" };

export default async function SettingsPage() {
  const ctx = await requireAdmin().catch(() => notFound());
  const { data } = await ctx.supabase.from("app_settings").select("key, value").eq("is_public", true);
  return <SiteSettingsAdmin settings={mergeSettings(data)} />;
}
