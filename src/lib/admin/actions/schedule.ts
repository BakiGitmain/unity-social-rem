"use server";

import { updateTag } from "next/cache";
import { adminAction, fail } from "@/lib/admin/action";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : fail("Invalid id"));
const text = (v: unknown, max: number, label: string, required = false) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) fail(`${label} is needed`);
  if (s.length > max) fail(`${label} is too long`);
  return s;
};

/* ---------------- class sections ---------------- */

export type SectionInput = { name_en: string; name_am: string; school_en: string; school_am: string; year_ec: number | null; is_default: boolean };

export async function saveSection(sectionId: string | null, input: SectionInput) {
  return adminAction(async (ctx) => {
    const row = {
      name_en: text(input.name_en, 80, "Name", true),
      name_am: text(input.name_am, 80, "Amharic name", true),
      school_en: text(input.school_en, 120, "School"),
      school_am: text(input.school_am, 120, "Amharic school"),
      year_ec: input.year_ec === null || String(input.year_ec) === "" ? null : Math.round(Number(input.year_ec)),
      is_default: !!input.is_default,
    };
    if (row.year_ec !== null && (row.year_ec < 1990 || row.year_ec > 2100)) fail("Year (E.C.) looks wrong");
    if (row.is_default) await ctx.supabase.from("class_sections").update({ is_default: false }).neq("id", sectionId ?? "00000000-0000-0000-0000-000000000000");
    if (sectionId) {
      const { data: before } = await ctx.supabase.from("class_sections").select("*").eq("id", id(sectionId)).maybeSingle();
      const { error } = await ctx.supabase.from("class_sections").update(row).eq("id", sectionId);
      if (error) fail("Could not save the section");
      await ctx.audit("schedule.section_update", "class_section", sectionId, before, row);
    } else {
      const slug = `${row.name_en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
      const { data, error } = await ctx.supabase.from("class_sections").insert({ ...row, slug }).select("id").single();
      if (error) fail("Could not add the section");
      await ctx.audit("schedule.section_add", "class_section", data.id as string, null, row);
    }
    updateTag("content");
    return null;
  });
}

/* ---------------- timetable entries ---------------- */

export type EntryInput = {
  section_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  period_label: string;
  period_start: number;
  period_end: number;
  subject_slug: string;
  room_en: string;
  room_am: string;
  floor: number;
};

export async function saveEntry(entryId: string | null, input: EntryInput) {
  return adminAction(async (ctx) => {
    const day = Math.round(Number(input.day_of_week));
    if (day < 1 || day > 7) fail("Choose a day");
    if (!TIME.test(input.start_time) || !TIME.test(input.end_time) || input.end_time <= input.start_time) fail("Check the start and end times");
    const ps = Math.round(Number(input.period_start));
    const pe = Math.round(Number(input.period_end));
    if (ps < 1 || ps > 8 || pe < ps || pe > 8) fail("Periods must be 1–8 (end ≥ start)");
    const row = {
      section_id: id(input.section_id),
      day_of_week: day,
      start_time: input.start_time,
      end_time: input.end_time,
      period_label: text(input.period_label, 20, "Period label", true),
      period_start: ps,
      period_end: pe,
      subject_slug: text(input.subject_slug, 40, "Subject", true),
      room_en: text(input.room_en, 80, "Room", true),
      room_am: text(input.room_am, 80, "Amharic room") || text(input.room_en, 80, "Room", true),
      floor: Math.round(Number(input.floor)),
    };
    if (!Number.isFinite(row.floor) || row.floor < 0 || row.floor > 50) fail("Floor must be 0–50");
    if (entryId) {
      const { data: before } = await ctx.supabase.from("schedule_entries").select("*").eq("id", id(entryId)).maybeSingle();
      const { error } = await ctx.supabase.from("schedule_entries").update(row).eq("id", entryId);
      if (error) fail("Could not save the class");
      await ctx.audit("schedule.entry_update", "schedule_entry", entryId, before, row);
    } else {
      const { data, error } = await ctx.supabase.from("schedule_entries").insert(row).select("id").single();
      if (error) fail("Could not add the class");
      await ctx.audit("schedule.entry_add", "schedule_entry", data.id as string, null, row);
    }
    updateTag("content");
    return null;
  });
}

export async function deleteEntry(entryId: string) {
  return adminAction(async (ctx) => {
    const { data: before } = await ctx.supabase.from("schedule_entries").select("*").eq("id", id(entryId)).maybeSingle();
    if (!before) fail("Not found");
    const { error } = await ctx.supabase.from("schedule_entries").delete().eq("id", entryId);
    if (error) fail("Could not delete the class");
    await ctx.audit("schedule.entry_delete", "schedule_entry", entryId, before, null);
    updateTag("content");
    return null;
  });
}

/* ---------------- date overrides ---------------- */

export type OverrideInput = {
  section_id: string;
  date: string;
  kind: "cancel" | "extra" | "room" | "holiday" | "exam";
  entry_id: string | null;
  subject_slug: string | null;
  start_time: string | null;
  end_time: string | null;
  room_en: string;
  room_am: string;
  floor: number | null;
  title_en: string;
  title_am: string;
  note_en: string;
  note_am: string;
};

export async function addOverride(input: OverrideInput) {
  return adminAction(async (ctx) => {
    if (!DATE.test(input.date)) fail("Choose a date");
    if (!["cancel", "extra", "room", "holiday", "exam"].includes(input.kind)) fail("Choose a type");
    const needsEntry = input.kind === "cancel" || input.kind === "room";
    const needsTime = input.kind === "extra" || input.kind === "exam";
    if (needsEntry && !input.entry_id) fail("Choose the class");
    if (needsTime && (!input.start_time || !input.end_time || !TIME.test(input.start_time) || !TIME.test(input.end_time) || input.end_time <= input.start_time)) fail("Check the start and end times");
    if (input.kind === "room" && !input.room_en.trim()) fail("Enter the new room");
    if (input.kind === "extra" && !input.subject_slug) fail("Choose the subject");
    const row = {
      section_id: id(input.section_id),
      date: input.date,
      kind: input.kind,
      entry_id: needsEntry ? id(input.entry_id) : null,
      subject_slug: input.kind === "extra" || input.kind === "exam" ? input.subject_slug || null : null,
      start_time: needsTime ? input.start_time : null,
      end_time: needsTime ? input.end_time : null,
      room_en: text(input.room_en, 80, "Room") || null,
      room_am: text(input.room_am, 80, "Amharic room") || null,
      floor: input.floor === null || String(input.floor) === "" ? null : Math.round(Number(input.floor)),
      title_en: text(input.title_en, 120, "Title") || null,
      title_am: text(input.title_am, 120, "Amharic title") || null,
      note_en: text(input.note_en, 300, "Note") || null,
      note_am: text(input.note_am, 300, "Amharic note") || null,
    };
    const { data, error } = await ctx.supabase.from("schedule_overrides").insert(row).select("id").single();
    if (error) fail("Could not save the change");
    await ctx.audit(`schedule.override_${input.kind}`, "schedule_override", data.id as string, null, row);
    updateTag("content");
    return null;
  });
}

export async function deleteOverride(overrideId: string) {
  return adminAction(async (ctx) => {
    const { data: before } = await ctx.supabase.from("schedule_overrides").select("*").eq("id", id(overrideId)).maybeSingle();
    if (!before) fail("Not found");
    const { error } = await ctx.supabase.from("schedule_overrides").delete().eq("id", overrideId);
    if (error) fail("Could not delete the change");
    await ctx.audit("schedule.override_delete", "schedule_override", overrideId, before, null);
    updateTag("content");
    return null;
  });
}
