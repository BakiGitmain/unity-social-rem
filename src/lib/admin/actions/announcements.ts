"use server";

import { adminAction, fail } from "@/lib/admin/action";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AnnouncementInput = {
  title_en: string;
  title_am: string;
  message_en: string;
  message_am: string;
  type: "info" | "success" | "warning" | "urgent";
  link_url: string | null;
  /** ISO strings or null */
  starts_at: string | null;
  ends_at: string | null;
  audience: "everyone" | "logged_in";
  published: boolean;
};

function clean(a: AnnouncementInput) {
  const t = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const row = {
    title_en: t(a.title_en, 120),
    title_am: t(a.title_am, 120),
    message_en: t(a.message_en, 600),
    message_am: t(a.message_am, 600),
    type: ["info", "success", "warning", "urgent"].includes(a.type) ? a.type : "info",
    link_url: a.link_url?.trim() || null,
    starts_at: a.starts_at || null,
    ends_at: a.ends_at || null,
    audience: a.audience === "logged_in" ? "logged_in" : "everyone",
    published: !!a.published,
    updated_at: new Date().toISOString(),
  };
  if (!row.title_en) fail("The English title is needed");
  if (row.link_url && !(/^https:\/\//.test(row.link_url) || /^\/[\w\-./?=&#]*$/.test(row.link_url))) fail("The link must start with https:// or /");
  for (const d of [row.starts_at, row.ends_at]) if (d && Number.isNaN(new Date(d).getTime())) fail("Check the dates");
  if (row.starts_at && row.ends_at && new Date(row.ends_at) <= new Date(row.starts_at)) fail("The end must be after the start");
  return row;
}

export async function saveAnnouncement(annId: string | null, input: AnnouncementInput) {
  return adminAction(async (ctx) => {
    const row = clean(input);
    if (annId) {
      if (!UUID.test(annId)) fail("Invalid id");
      const { data: before } = await ctx.supabase.from("announcements").select("*").eq("id", annId).maybeSingle();
      if (!before) fail("Not found");
      const { error } = await ctx.supabase.from("announcements").update(row).eq("id", annId);
      if (error) fail("Could not save the announcement");
      await ctx.audit("announcement.update", "announcement", annId, before, row);
      return annId;
    }
    const { data, error } = await ctx.supabase.from("announcements").insert(row).select("id").single();
    if (error) fail("Could not save the announcement");
    await ctx.audit("announcement.create", "announcement", data.id as string, null, row);
    return data.id as string;
  });
}

export async function deleteAnnouncement(annId: string) {
  return adminAction(async (ctx) => {
    if (!UUID.test(annId)) fail("Invalid id");
    const { data: before } = await ctx.supabase.from("announcements").select("*").eq("id", annId).maybeSingle();
    if (!before) fail("Not found");
    const { error } = await ctx.supabase.from("announcements").delete().eq("id", annId);
    if (error) fail("Could not delete the announcement");
    await ctx.audit("announcement.delete", "announcement", annId, before, null);
    return null;
  });
}
