"use server";

import { updateTag } from "next/cache";
import { adminAction, fail } from "@/lib/admin/action";
import { ICON_NAMES, toSavePayload, validateLesson, type EditorData } from "@/lib/admin/lesson-validate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["published", "draft", "coming_soon"];
const TABLES = ["subjects", "grades", "units", "lessons"] as const;
type Table = (typeof TABLES)[number];

function id(v: unknown) {
  if (typeof v !== "string" || !UUID.test(v)) fail("Invalid id");
  return v;
}

/** Published / Draft / Coming soon. Applies immediately (and refreshes the cached public pages). */
export async function setStatus(table: Table, itemId: string, status: string) {
  return adminAction(async (ctx) => {
    if (!TABLES.includes(table)) fail("Invalid item");
    if (!STATUSES.includes(status)) fail("Invalid status");
    const { data: before } = await ctx.supabase.from(table).select("status").eq("id", id(itemId)).maybeSingle();
    if (!before) fail("Not found");
    const { error } = await ctx.supabase.from(table).update({ status }).eq("id", itemId);
    if (error) fail("Could not change the status");
    await ctx.audit("content.status", table.slice(0, -1), itemId, before, { status });
    updateTag("content");
    return status;
  });
}

/** Drag-and-drop order (subjects, or lessons inside one unit). Atomic in the database. */
export async function reorder(kind: "subjects" | "lessons", ids: string[]) {
  return adminAction(async (ctx) => {
    if (!Array.isArray(ids) || ids.length > 200) fail("Invalid order");
    ids.forEach(id);
    const { error } = await ctx.supabase.rpc("admin_reorder", { p_kind: kind, p_ids: ids });
    if (error) fail("Could not save the order");
    updateTag("content");
    return null;
  });
}

export type SubjectInput = {
  name_en: string;
  name_am: string;
  description_en: string;
  description_am: string;
  color: string | null;
  icon: string | null;
  illustration: string | null;
  status: string;
};

export async function updateSubject(subjectId: string, input: SubjectInput) {
  return adminAction(async (ctx) => {
    const s = input;
    if (![s.name_en, s.name_am].every((v) => typeof v === "string" && v.trim() && v.length <= 80)) fail("Name is needed in both languages");
    if (![s.description_en, s.description_am].every((v) => typeof v === "string" && v.length <= 500)) fail("Description is too long");
    if (s.color !== null && !/^#[0-9a-fA-F]{6}$/.test(s.color)) fail("Colour must look like #0f766e");
    if (s.icon !== null && !ICON_NAMES.includes(s.icon)) fail("Unknown icon");
    if (s.illustration !== null && !(/^https:\/\//.test(s.illustration) || /^\/[\w\-./]+$/.test(s.illustration))) fail("Illustration must be an https URL or a /public path");
    if (!STATUSES.includes(s.status)) fail("Invalid status");
    const { data: before } = await ctx.supabase
      .from("subjects")
      .select("name_en, name_am, description_en, description_am, color, icon, illustration, status")
      .eq("id", id(subjectId))
      .maybeSingle();
    if (!before) fail("Not found");
    const after = {
      name_en: s.name_en.trim(),
      name_am: s.name_am.trim(),
      description_en: s.description_en.trim(),
      description_am: s.description_am.trim(),
      color: s.color,
      icon: s.icon,
      illustration: s.illustration,
      status: s.status,
    };
    const { error } = await ctx.supabase.from("subjects").update(after).eq("id", subjectId);
    if (error) fail("Could not save the subject");
    await ctx.audit("subject.update", "subject", subjectId, before, after);
    updateTag("content");
    return null;
  });
}

/** Autosave of the editor's working copy (not visible to students). One audit row per lesson per 10 minutes. */
export async function saveLessonDraft(lessonId: string, data: EditorData) {
  return adminAction(async (ctx) => {
    id(lessonId);
    const size = JSON.stringify(data).length;
    if (size > 1_500_000) fail("The lesson is too big");
    const { data: prev } = await ctx.supabase.from("lesson_drafts").select("updated_at").eq("lesson_id", lessonId).maybeSingle();
    const now = new Date().toISOString();
    const { error } = await ctx.supabase.from("lesson_drafts").upsert({ lesson_id: lessonId, data, updated_at: now, updated_by: ctx.userId });
    if (error) fail("Could not save the draft");
    if (!prev || Date.now() - new Date(prev.updated_at as string).getTime() > 10 * 60 * 1000) {
      await ctx.audit("lesson.draft_autosave", "lesson", lessonId, null, { bytes: size });
    }
    return now;
  }, { revalidate: false });
}

export async function discardLessonDraft(lessonId: string) {
  return adminAction(async (ctx) => {
    const { error } = await ctx.supabase.from("lesson_drafts").delete().eq("lesson_id", id(lessonId));
    if (error) fail("Could not discard the draft");
    await ctx.audit("lesson.draft_discard", "lesson", lessonId, null, null);
    return null;
  });
}

/** Publish the editor's content: validated here again, saved atomically with a version + audit row. */
export async function publishLesson(lessonId: string, data: EditorData, note: string) {
  return adminAction(async (ctx) => {
    id(lessonId);
    if (data?.lesson?.id !== lessonId) fail("Lesson mismatch");
    const problems = validateLesson(data);
    if (problems.length) fail(`Fix ${problems.length} problem(s) first: ${problems[0]}`);
    const { data: version, error } = await ctx.supabase.rpc("admin_save_lesson", {
      p_lesson_id: lessonId,
      p_data: toSavePayload(data),
      p_note: (note || "Edited in admin").slice(0, 200),
    });
    if (error) fail("Could not publish the lesson");
    updateTag("content");
    return { version: version as number };
  });
}

export async function restoreLessonVersion(lessonId: string, versionId: number) {
  return adminAction(async (ctx) => {
    id(lessonId);
    const { data: v } = await ctx.supabase.from("lesson_versions").select("snapshot, created_at").eq("id", versionId).eq("lesson_id", lessonId).maybeSingle();
    if (!v) fail("Version not found");
    const snap = v.snapshot as { lesson: Record<string, unknown> };
    delete snap.lesson.status; // status is managed separately
    const { error } = await ctx.supabase.rpc("admin_save_lesson", {
      p_lesson_id: lessonId,
      p_data: snap,
      p_note: `Restored version #${versionId}`,
    });
    if (error) fail("Could not restore this version");
    updateTag("content");
    return null;
  });
}

export async function lessonVersions(lessonId: string) {
  return adminAction(async (ctx) => {
    const { data } = await ctx.supabase
      .from("lesson_versions")
      .select("id, note, created_at, created_by")
      .eq("lesson_id", id(lessonId))
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = [...new Set((data ?? []).map((v) => v.created_by).filter(Boolean))] as string[];
    const { data: names } = ids.length ? await ctx.supabase.from("profiles").select("id, username").in("id", ids) : { data: [] };
    const by = new Map((names ?? []).map((n) => [n.id as string, n.username as string]));
    return (data ?? []).map((v) => ({ id: v.id as number, note: v.note as string | null, created_at: v.created_at as string, by: by.get(v.created_by as string) ?? null }));
  }, { revalidate: false });
}

/** Called after an image upload to Storage (the upload itself is protected by storage RLS: admins with 2FA). */
export async function logUpload(path: string) {
  return adminAction(async (ctx) => {
    if (typeof path !== "string" || path.length > 300) fail("Invalid path");
    await ctx.audit("media.upload", "media", path, null, null);
    return null;
  }, { revalidate: false });
}
