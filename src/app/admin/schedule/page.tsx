import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { requestNow } from "@/lib/admin/queries";
import { ScheduleAdmin } from "@/components/admin/pages/schedule-admin";

export const metadata: Metadata = { title: "Schedule" };

export default async function ScheduleAdminPage() {
  const ctx = await requireAdmin().catch(() => notFound());
  const sb = ctx.supabase;
  const [sections, entries, overrides, subjects] = await Promise.all([
    sb.from("class_sections").select("id, slug, name_en, name_am, school_en, school_am, year_ec, is_default").order("created_at"),
    sb.from("schedule_entries").select("id, section_id, day_of_week, start_time, end_time, period_label, period_start, period_end, subject_slug, room_en, room_am, floor").order("day_of_week").order("start_time"),
    sb.from("schedule_overrides").select("*").order("date", { ascending: false }).limit(300),
    sb.from("subjects").select("slug, name_en").order("sort_order"),
  ]);
  return (
    <ScheduleAdmin
      sections={(sections.data ?? []) as Parameters<typeof ScheduleAdmin>[0]["sections"]}
      entries={(entries.data ?? []) as Parameters<typeof ScheduleAdmin>[0]["entries"]}
      overrides={(overrides.data ?? []) as Parameters<typeof ScheduleAdmin>[0]["overrides"]}
      subjects={(subjects.data ?? []) as { slug: string; name_en: string }[]}
      today={new Date((await requestNow()) + 3 * 3600e3).toISOString().slice(0, 10)}
    />
  );
}
