import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { timeToMinutes } from "@/lib/time/clock";
import type { ClassEntry } from "@/lib/time/schedule";
import type { ScheduleOverride } from "@/lib/time/overrides";
import type { GlossaryEntry, Grade, Lesson, LessonSection, LessonSummary, MainTopic, Subject, Unit } from "@/lib/types";

/** Content changes only via migrations. In dev keep the cache tiny so pushed migrations show up at once. */
function life() {
  if (process.env.NODE_ENV === "development") cacheLife("seconds");
  else cacheLife("hours");
}

/*
 * All reads are public content that only changes through migrations, so every
 * query is cached ("use cache") and fetched per page, never all at once.
 */

const LESSON_SUMMARY_COLUMNS =
  "id, unit_id, code, slug, sort_order, section_code, section_title_en, section_title_am, title_en, title_am, summary_en, summary_am, minutes, status, lesson_sections(count)";

export type SubjectCard = Subject & { unitCount: number; lessonCount: number };
export type UnitWithLessons = Unit & { lessons: LessonSummary[] };
export type GradeWithUnits = Grade & { units: UnitWithLessons[] };
export type SubjectTree = Subject & { grades: GradeWithUnits[] };
export type QuizMeta = {
  id: string;
  title_en: string;
  title_am: string;
  description_en: string;
  description_am: string;
  questionCount: number;
};

const byNumber = (a: { number: number }, b: { number: number }) => a.number - b.number;
const bySort = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;

/** Home page: the 4 subjects with how much content each has. */
export async function getSubjects(): Promise<SubjectCard[]> {
  "use cache";
  life();
  cacheTag("content");

  const { data, error } = await createPublicClient()
    .from("subjects")
    .select("*, grades(id, units(id, lessons(id)))")
    .order("sort_order");
  if (error) throw new Error(`Could not load subjects: ${error.message}`);

  type Row = Subject & { grades: { units: { lessons: { id: string }[] }[] }[] };
  return (data as Row[]).map(({ grades, ...s }) => {
    const units = grades.flatMap((g) => g.units);
    return { ...s, unitCount: units.length, lessonCount: units.reduce((n, u) => n + u.lessons.length, 0) };
  });
}

/** One subject with its grades, units and lesson titles (no lesson content). */
export async function getSubjectTree(subjectSlug: string): Promise<SubjectTree | null> {
  "use cache";
  life();
  cacheTag("content");

  const { data, error } = await createPublicClient()
    .from("subjects")
    .select(`*, grades(*, units(*, lessons(${LESSON_SUMMARY_COLUMNS})))`)
    .eq("slug", subjectSlug)
    .maybeSingle();
  if (error) throw new Error(`Could not load subject ${subjectSlug}: ${error.message}`);
  if (!data) return null;

  const tree = data as SubjectTree;
  tree.grades.sort(byNumber);
  for (const g of tree.grades) {
    g.units.sort(byNumber);
    for (const u of g.units) {
      u.lessons.sort(bySort);
      for (const l of u.lessons as (LessonSummary & { lesson_sections?: { count: number }[] })[]) {
        l.partCount = l.lesson_sections?.[0]?.count ?? 0;
        delete l.lesson_sections;
      }
    }
  }
  return tree;
}

/** The full content of one lesson: note parts, glossary, main topics and quiz info (not the questions). */
export async function getLessonContent(lessonId: string): Promise<{
  sections: LessonSection[];
  mainTopics: MainTopic[];
  glossary: GlossaryEntry[];
  quiz: QuizMeta | null;
}> {
  "use cache";
  life();
  cacheTag("content");

  const { data, error } = await createPublicClient()
    .from("lessons")
    .select(
      "main_topics, glossary, lesson_sections(id, sort_order, title_en, title_am, icon, blocks), quizzes(id, title_en, title_am, description_en, description_am, quiz_questions(count))",
    )
    .eq("id", lessonId)
    .single();
  if (error) throw new Error(`Could not load lesson ${lessonId}: ${error.message}`);

  type Row = Pick<Lesson, "main_topics" | "glossary" | "lesson_sections"> & {
    quizzes: (Omit<QuizMeta, "questionCount"> & { quiz_questions: { count: number }[] }) | null;
  };
  const row = data as unknown as Row;
  const q = row.quizzes;
  return {
    sections: [...row.lesson_sections].sort(bySort),
    mainTopics: row.main_topics,
    glossary: row.glossary ?? [],
    quiz: q
      ? {
          id: q.id,
          title_en: q.title_en,
          title_am: q.title_am,
          description_en: q.description_en,
          description_am: q.description_am,
          questionCount: q.quiz_questions[0]?.count ?? 0,
        }
      : null,
  };
}

/* ---------------- static params (prerendered at build time) ---------------- */

async function getAllPaths() {
  "use cache";
  life();
  cacheTag("content");

  const { data, error } = await createPublicClient()
    .from("subjects")
    .select("slug, grades(slug, units(slug, lessons(slug)))");
  if (error) throw new Error(`Could not load paths: ${error.message}`);
  return data as { slug: string; grades: { slug: string; units: { slug: string; lessons: { slug: string }[] }[] }[] }[];
}

export async function getSubjectParams() {
  return (await getAllPaths()).map((s) => ({ subject: s.slug }));
}

export async function getGradeParams() {
  return (await getAllPaths()).flatMap((s) => s.grades.map((g) => ({ subject: s.slug, grade: g.slug })));
}

export async function getUnitParams() {
  return (await getAllPaths()).flatMap((s) =>
    s.grades.flatMap((g) => g.units.map((u) => ({ subject: s.slug, grade: g.slug, unit: u.slug }))),
  );
}

export async function getLessonParams() {
  return (await getAllPaths()).flatMap((s) =>
    s.grades.flatMap((g) =>
      g.units.flatMap((u) =>
        u.lessons.map((l) => ({ subject: s.slug, grade: g.slug, unit: u.slug, lesson: l.slug })),
      ),
    ),
  );
}

/* ---------------- class schedule ---------------- */

export type ScheduleData = {
  section: { name_en: string; name_am: string; school_en: string; school_am: string; year_ec: number | null };
  entries: ClassEntry[];
  /** Date changes (cancel, room, extra, exam, holiday), applied by src/lib/time/overrides.ts. */
  overrides: ScheduleOverride[];
};

/** The default class section and its weekly timetable (times in Addis Ababa local time). */
export async function getSchedule(): Promise<ScheduleData | null> {
  "use cache";
  life();
  cacheTag("content");

  const { data, error } = await createPublicClient()
    .from("class_sections")
    .select(
      "name_en, name_am, school_en, school_am, year_ec, schedule_entries(id, day_of_week, start_time, end_time, period_label, period_start, period_end, subject_slug, room_en, room_am, floor, subjects(name_en, name_am)), schedule_overrides(id, date, kind, entry_id, subject_slug, start_time, end_time, room_en, room_am, floor, title_en, title_am, note_en, note_am, subjects(name_en, name_am))",
    )
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw new Error(`Could not load schedule: ${error.message}`);
  if (!data) return null;

  type Row = {
    id: string;
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
    subjects: { name_en: string; name_am: string } | null;
  };
  type ORow = {
    id: string;
    date: string;
    kind: ScheduleOverride["kind"];
    entry_id: string | null;
    subject_slug: string | null;
    start_time: string | null;
    end_time: string | null;
    room_en: string | null;
    room_am: string | null;
    floor: number | null;
    title_en: string | null;
    title_am: string | null;
    note_en: string | null;
    note_am: string | null;
    subjects: { name_en: string; name_am: string } | null;
  };
  const { schedule_entries, schedule_overrides, ...section } = data as unknown as ScheduleData["section"] & {
    schedule_entries: Row[];
    schedule_overrides: ORow[] | null;
  };
  const overrides: ScheduleOverride[] = (schedule_overrides ?? []).map((o) => ({
    id: o.id,
    date: o.date,
    kind: o.kind,
    entryId: o.entry_id,
    subject: o.subject_slug,
    subjectEn: o.subjects?.name_en ?? null,
    subjectAm: o.subjects?.name_am ?? null,
    start: o.start_time ? timeToMinutes(o.start_time) : null,
    end: o.end_time ? timeToMinutes(o.end_time) : null,
    roomEn: o.room_en,
    roomAm: o.room_am,
    floor: o.floor,
    titleEn: o.title_en,
    titleAm: o.title_am,
    noteEn: o.note_en,
    noteAm: o.note_am,
  }));
  const entries: ClassEntry[] = schedule_entries
    .map((r) => ({
      id: r.id,
      day: r.day_of_week,
      start: timeToMinutes(r.start_time),
      end: timeToMinutes(r.end_time),
      periodLabel: r.period_label,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      subject: r.subject_slug,
      subjectEn: r.subjects?.name_en ?? r.subject_slug,
      subjectAm: r.subjects?.name_am ?? r.subject_slug,
      roomEn: r.room_en,
      roomAm: r.room_am,
      floor: r.floor,
    }))
    .sort((a, b) => a.day - b.day || a.start - b.start);
  return { section: section as ScheduleData["section"], entries, overrides };
}

/* ---------------- AI tutor ---------------- */

/** Lesson context for the AI tutor route: where the lesson sits + its parts and main topics. */
export async function getTutorLesson(lessonId: string): Promise<import("@/lib/tutor/prompt").TutorLesson | null> {
  "use cache";
  life();
  cacheTag("content");

  const { data, error } = await createPublicClient()
    .from("lessons")
    .select(
      "code, title_en, title_am, main_topics, glossary, lesson_sections(id, sort_order, title_en, title_am, icon, blocks), units(label_en, title_en, grades(number, subjects(name_en)))",
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (error || !data) return null;

  type Row = {
    code: string;
    title_en: string;
    title_am: string;
    main_topics: MainTopic[];
    glossary: GlossaryEntry[] | null;
    lesson_sections: LessonSection[];
    units: { label_en: string; title_en: string; grades: { number: number; subjects: { name_en: string } | null } | null } | null;
  };
  const r = data as unknown as Row;
  return {
    subject: r.units?.grades?.subjects?.name_en ?? "",
    grade: r.units?.grades?.number ?? 0,
    unit: r.units ? `${r.units.label_en}: ${r.units.title_en}` : "",
    code: r.code,
    title: { en: r.title_en, am: r.title_am },
    sections: [...r.lesson_sections].sort(bySort),
    mainTopics: r.main_topics ?? [],
    glossary: r.glossary ?? [],
  };
}
