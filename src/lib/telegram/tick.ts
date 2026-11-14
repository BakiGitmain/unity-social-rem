import "server-only";
import { getSchedule } from "@/lib/data";
import { addisParts } from "@/lib/time/clock";
import { isoDate } from "@/lib/time/overrides";
import { takeSentCount } from "@/lib/telegram/api";
import { SITE_URL, announceLesson } from "@/lib/telegram/bot";
import { broadcast } from "@/lib/telegram/broadcast";
import { audience, botDb, flushSent, loadLessons, type BotDb } from "@/lib/telegram/db";
import { newLessons } from "@/lib/telegram/lessons";
import { planTick } from "@/lib/telegram/reminders";
import { reminderView, summaryView } from "@/lib/telegram/views";

/** At most this many new lessons are announced per tick (the rest go out 5 minutes later). */
const LESSONS_PER_TICK = 3;

/** Claims a reminder key for a date. Only the first caller gets true, so a reminder is never sent twice. */
async function claimReminder(db: BotDb, classId: string, date: string): Promise<boolean> {
  const { data, error } = await db
    .from("telegram_reminders_sent")
    .upsert({ class_id: classId, date }, { onConflict: "class_id,date", ignoreDuplicates: true })
    .select("class_id");
  return !error && !!data?.length;
}

async function claimLesson(db: BotDb, lessonId: string, key: string): Promise<boolean> {
  const { data, error } = await db
    .from("telegram_sent_lessons")
    .upsert({ lesson_id: lessonId, lesson_key: key, recipients: 0 }, { onConflict: "lesson_id", ignoreDuplicates: true })
    .select("lesson_id");
  return !error && !!data?.length;
}

/**
 * One tick (every 5 minutes, from pg_cron): the 7:00 summary, reminders 15 minutes before each class, and
 * announcements of newly published lessons. Returns what was sent (counts only, no chat ids).
 */
export async function runTick(nowMs: number) {
  const db = botDb();
  const out = { date: isoDate(addisParts(nowMs)), summary: 0, reminders: 0, lessons: 0, recipients: 0 };
  try {
    /* 1) class reminders + morning summary */
    const s = await getSchedule();
    if (s) {
      const { data: sentRows } = await db.from("telegram_reminders_sent").select("class_id").eq("date", out.date);
      const plan = planTick(s.entries, s.overrides, nowMs, new Set(((sentRows ?? []) as { class_id: string }[]).map((r) => r.class_id)));
      if (plan.summary || plan.reminders.length) {
        const people = await audience(db, { reminders: true });
        if (plan.summary && (await claimReminder(db, plan.summary.key, plan.date))) {
          const r = await broadcast(db, people, (lang) => summaryView(s, plan.date, plan.weekday, lang, SITE_URL));
          out.summary++;
          out.recipients += r.sent;
        }
        for (const due of plan.reminders) {
          if (!(await claimReminder(db, due.key, due.date))) continue;
          const r = await broadcast(db, people, (lang) => reminderView(due.cls, due.minutesUntil, lang));
          out.reminders++;
          out.recipients += r.sent;
        }
      }
    }

    /* 2) newly published lessons */
    const light = await loadLessons();
    const { data: sentLessons } = await db.from("telegram_sent_lessons").select("lesson_id");
    const fresh = newLessons(light, new Set(((sentLessons ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id)));
    if (fresh.length) {
      const full = new Map((await loadLessons({ homework: true })).map((l) => [l.id, l]));
      for (const l of fresh.slice(0, LESSONS_PER_TICK)) {
        const lesson = full.get(l.id) ?? l;
        if (!(await claimLesson(db, lesson.id, lesson.key))) continue;
        const r = await announceLesson(db, lesson);
        out.lessons++;
        out.recipients += r.sent;
      }
    }
  } finally {
    await flushSent(db, takeSentCount()).catch(() => {});
  }
  return out;
}
