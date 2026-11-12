"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpenText, Clock, Layers, ListChecks, NotebookPen, Target } from "lucide-react";
import { useLang } from "@/lib/use-lang";
import { loc, type Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import type { GlossaryEntry, HomeworkItem, LessonSection, LessonSummary, MainTopic } from "@/lib/types";
import type { QuizMeta } from "@/lib/data";
import { LanguageToggle } from "@/components/study/language-toggle";
import { NoteBlock } from "@/components/study/blocks";
import { MainTopics } from "@/components/study/main-topics";
import { SectionIcon } from "@/components/study/section-icon";
import { BiText } from "@/components/study/text";
import { GlossaryProvider } from "@/components/study/glossary";
import { LearnMode } from "@/components/study/learn-mode";
import { Tutor } from "@/components/tutor/tutor";
import { useSiteSettings } from "@/components/site-settings";

// Homework (answer tools, scratchpad, calculator) is only downloaded when its tab is opened.
const Homework = dynamic(() => import("@/components/study/homework").then((m) => m.Homework), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-16" role="status">
      <span className="spinner" aria-hidden />
    </div>
  ),
});

// The quiz (and its Supabase query) is only downloaded when the Quiz tab is opened.
const Quiz = dynamic(() => import("@/components/study/quiz"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-16" role="status">
      <span className="spinner" aria-hidden />
      <span className="sr-only">Loading quiz</span>
    </div>
  ),
});

type Tab = "notes" | "topics" | "homework" | "quiz";
type NotesMode = "learn" | "all";
type NavLesson = { href: string; code: string; title_en: string; title_am: string } | null;

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { type: "spring", stiffness: 380, damping: 36 },
} as const;

export function StudyView({
  subject,
  subjectId,
  lesson,
  sections,
  mainTopics,
  glossary,
  homework = [],
  practice = [],
  quiz,
  prev,
  next,
  unitLabel,
  unitHref,
  locale,
}: {
  /** Subject slug (e.g. "mathematics"): decides defaults like the calculation tools. */
  subject?: string;
  subjectId?: string;
  lesson: LessonSummary;
  sections: LessonSection[];
  mainTopics: MainTopic[];
  glossary: GlossaryEntry[];
  homework?: HomeworkItem[];
  practice?: HomeworkItem[];
  quiz: QuizMeta | null;
  prev: NavLesson;
  next: NavLesson;
  unitLabel: string;
  unitHref: string;
  locale: Locale;
}) {
  const [lang, setLang] = useLang(); // notes language: en | am | both
  const [tab, setTab] = useState<Tab>("notes");
  const [chosenMode, setMode] = useState<NotesMode>("learn");
  // Feature flag (Admin → Site settings): Learn mode can be switched off for everyone.
  const learnOn = useSiteSettings().settings.features.learn_mode;
  const mode: NotesMode = learnOn ? chosenMode : "all";
  const [quizVisited, setQuizVisited] = useState(false);
  const [quizRunning, setQuizRunning] = useState(false);
  const [quizStartKey, setQuizStartKey] = useState(0);
  const [tutorPart, setTutorPart] = useState(0);
  const [learnFinished, setLearnFinished] = useState(false);
  const completedSent = useRef(false);
  const onFinishedChange = useCallback(
    (f: boolean) => {
      setLearnFinished(f);
      if (f && !completedSent.current) {
        completedSent.current = true;
        track({ type: "lesson_complete", lessonId: lesson.id });
      }
    },
    [lesson.id],
  );
  useEffect(() => track({ type: "lesson_view", lessonId: lesson.id }), [lesson.id]);
  useEffect(() => {
    const p = Number(new URLSearchParams(window.location.search).get("part"));
    if (!Number.isInteger(p) || p < 1) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode("all");
    const id = setTimeout(() => document.getElementById(`part-${p}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 450);
    return () => clearTimeout(id);
  }, []);
  const amUi = locale === "am" ? "am" : "";

  // Rem (AI tutor): only on the notes and Main Topics, never in the quiz or on the finished screen.
  const tutorHidden = tab === "quiz" || tab === "homework" || quizRunning || (tab === "notes" && mode === "learn" && learnFinished);
  const tutorView = tab === "topics" ? "topics" : mode === "learn" ? "learn" : "all";

  const openTab = (to: Tab) => {
    setTab(to);
    if (to === "quiz") setQuizVisited(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tabs: { id: Tab; label: string; icon: typeof BookOpenText }[] = [
    { id: "notes", label: t(locale, "fullNotes"), icon: BookOpenText },
    { id: "topics", label: t(locale, "mainTopics"), icon: ListChecks },
    ...(homework.length || practice.length ? [{ id: "homework" as const, label: t(locale, "homework"), icon: NotebookPen }] : []),
    { id: "quiz", label: t(locale, "quiz"), icon: Target },
  ];

  return (
    <GlossaryProvider entries={glossary} lang={lang}>
      {/* Title (site language) */}
      <header className={`mt-5 ${amUi}`}>
        <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent-ink">
          <span className="tabular-nums">{lesson.code}</span>
          <span aria-hidden>·</span>
          <span>{loc(lesson, "section_title", locale)}</span>
        </p>
        <h1 className="mt-3 text-[1.7rem] leading-tight font-semibold tracking-tight text-ink sm:text-4xl">
          {loc(lesson, "title", locale)}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>{unitLabel}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {t(locale, "minutes", { n: lesson.minutes })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Layers className="size-3.5" aria-hidden />
            {sections.length} {t(locale, "parts")}
          </span>
          {quiz && (
            <span className="inline-flex items-center gap-1">
              <Target className="size-3.5" aria-hidden />
              {quiz.questionCount} {t(locale, "questions")}
            </span>
          )}
        </p>
      </header>

      {/* Controls */}
      <div className="sticky top-14 z-20 -mx-4 mt-5 bg-paper/90 px-4 py-3 backdrop-blur-md md:top-16 sm:mx-0 sm:px-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AnimatePresence initial={false} mode="wait">
            {quizRunning ? (
              <motion.p
                key="focus"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`flex h-11 items-center gap-2 text-sm font-medium text-muted ${amUi}`}
              >
                <Target className="size-4 text-accent" aria-hidden />
                {t(locale, "focusMode")} · {t(locale, "notesHidden")}
              </motion.p>
            ) : (
              <motion.div
                key="tabs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                role="tablist"
                aria-label="Study mode"
                className="no-scrollbar flex overflow-x-auto rounded-full bg-ink/[0.05] p-1"
              >
                {tabs.map(({ id, label, icon: Icon }) => {
                  const active = tab === id;
                  return (
                    <motion.button
                      key={id}
                      type="button"
                      role="tab"
                      id={`tab-${id}`}
                      aria-selected={active}
                      aria-controls={`panel-${id}`}
                      onClick={() => openTab(id)}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 600, damping: 30 }}
                      className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:flex-none sm:px-4 ${
                        active ? "text-ink" : "text-muted hover:text-ink"
                      } ${amUi ? "am leading-normal" : ""}`}
                    >
                      {active && (
                        <motion.span
                          layoutId="tab-pill"
                          className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(29,42,44,0.14)]"
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        />
                      )}
                      <Icon className={`relative size-4 transition-colors ${active ? "text-accent" : ""}`} aria-hidden />
                      <span className="relative">{label}</span>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2">
            <span className={`hidden text-xs text-faint lg:inline ${amUi}`}>{t(locale, "notesLanguage")}</span>
            <LanguageToggle lang={lang} onChange={setLang} />
          </div>
        </div>
      </div>

      {/* Panels */}
      <div className="mt-6">
        <AnimatePresence mode="wait" initial={false}>
          {tab === "notes" && (
            <motion.div key="notes" id="panel-notes" role="tabpanel" aria-labelledby="tab-notes" data-tutor-notes {...fade}>
              {/* Learn (one part at a time) | Read all */}
              <div className={`mb-8 flex justify-center ${learnOn ? "" : "hidden"}`}>
                <div role="radiogroup" aria-label={t(locale, "fullNotes")} className="inline-flex rounded-full bg-ink/[0.05] p-1">
                  {(["learn", "all"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={`relative rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
                        mode === m ? "text-white" : "text-muted hover:text-ink"
                      } ${amUi}`}
                    >
                      {mode === m && (
                        <motion.span
                          layoutId="notes-mode-pill"
                          className="absolute inset-0 rounded-full bg-accent"
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        />
                      )}
                      <span className="relative">{t(locale, m === "learn" ? "learn" : "readAll")}</span>
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {mode === "learn" ? (
                  <motion.div key="learn" {...fade}>
                    <LearnMode
                      lessonId={lesson.id}
                      lessonTitle={loc(lesson, "title", locale)}
                      sections={sections}
                      lang={lang}
                      locale={locale}
                      hasQuiz={!!quiz}
                      exitHref={unitHref}
                      onPartChange={setTutorPart}
                      onFinishedChange={onFinishedChange}
                      onStartQuiz={() => {
                        setQuizStartKey((k) => k + 1);
                        openTab("quiz");
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="all" {...fade}>
                    <ReadAll sections={sections} lang={lang} locale={locale} onPartChange={setTutorPart} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {tab === "topics" && (
            <motion.div key="topics" id="panel-topics" role="tabpanel" aria-labelledby="tab-topics" data-tutor-notes {...fade}>
              <MainTopics topics={mainTopics} lang={lang} locale={locale} />
            </motion.div>
          )}

          {tab === "homework" && (homework.length > 0 || practice.length > 0) && (
            <motion.div key="homework" id="panel-homework" role="tabpanel" aria-labelledby="tab-homework" {...fade}>
              <Homework lessonId={lesson.id} subject={subject} items={homework} practice={practice} lang={lang} locale={locale} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quiz stays mounted once opened so progress survives tab switches. */}
        {quizVisited && (
          <div id="panel-quiz" role="tabpanel" aria-labelledby="tab-quiz" hidden={tab !== "quiz"}>
            {quiz ? (
              <Quiz
                quiz={quiz}
                lessonId={lesson.id}
                lang={lang}
                locale={locale}
                autoStartKey={quizStartKey}
                onRunningChange={setQuizRunning} onBackToNotes={() => openTab("notes")} />
            ) : (
              <p className={`py-12 text-center text-muted ${amUi}`}>{t(locale, "noQuiz")}</p>
            )}
          </div>
        )}
      </div>

      {/* Previous / next lesson (hidden in focus mode) */}
      {!quizRunning && (prev || next) && (
        <nav aria-label="Lesson navigation" className="mt-14 grid gap-3 sm:grid-cols-2">
          {prev ? <LessonLink item={prev} dir="prev" locale={locale} /> : <span className="hidden sm:block" />}
          {next && <LessonLink item={next} dir="next" locale={locale} />}
        </nav>
      )}
      <Tutor
        lessonId={lesson.id}
        lessonTitle={`${lesson.code} ${loc(lesson, "title", locale)}`}
        locale={locale}
        view={tutorView}
        part={tutorPart}
        hidden={tutorHidden}
        notes={{
          lesson: { id: lesson.id, subjectId, code: lesson.code, title: loc(lesson, "title", locale) },
          href: `${unitHref}/${lesson.slug}`,
          label: `${unitLabel.split(" · ")[0]} · ${lesson.code} ${loc(lesson, "title", locale)}`,
        }}
      />
    </GlossaryProvider>
  );
}

/** The whole lesson on one page, calmer than before: no card borders, 65ch line length. */
export function ReadAll({
  sections,
  lang,
  locale,
  onPartChange,
}: {
  sections: LessonSection[];
  lang: ReturnType<typeof useLang>[0];
  locale: Locale;
  onPartChange: (index: number) => void;
}) {
  // Scroll-spy: the part nearest the top of the screen is the AI tutor context.
  useEffect(() => {
    const els = sections.map((_, i) => document.getElementById(`part-${i + 1}`)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    onPartChange(0);
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) onPartChange(els.indexOf(top.target as HTMLElement));
      },
      { rootMargin: "-30% 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections, onPartChange]);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0">
        {sections.map((s, i) => (
          <section key={s.id} id={`part-${i + 1}`} className="mx-auto max-w-[65ch] scroll-mt-40 border-b border-line pb-10 not-first:pt-10 last:border-b-0">
            <h2 className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                <SectionIcon name={s.icon} />
              </span>
              <span className={`text-xl leading-snug font-semibold text-ink sm:text-2xl ${lang === "am" ? "am" : ""}`}>
                <BiText value={{ en: s.title_en, am: s.title_am }} lang={lang} single />
              </span>
            </h2>
            <div className="mt-6">
              {s.blocks.map((b, j) => (
                <NoteBlock key={j} block={b} lang={lang} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <aside className="hidden lg:block">
        <nav aria-label={t(locale, "onThisPage")} className="sticky top-40">
          <p className={`text-xs font-semibold tracking-wider text-faint uppercase ${locale === "am" ? "am normal-case" : ""}`}>
            {t(locale, "onThisPage")}
          </p>
          <ol className="mt-3 space-y-1 border-l border-line">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#part-${i + 1}`}
                  onClick={(e) => {
                    const el = document.getElementById(`part-${i + 1}`);
                    if (!el) return;
                    e.preventDefault();
                    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
                    history.replaceState(null, "", `#part-${i + 1}`);
                  }}
                  className={`-ml-px block border-l-2 border-transparent py-1.5 pl-3 text-sm text-muted transition-colors hover:border-accent hover:text-ink ${lang === "am" ? "am" : ""}`}
                >
                  {lang === "am" ? s.title_am : s.title_en}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
    </div>
  );
}

function LessonLink({ item, dir, locale }: { item: NonNullable<NavLesson>; dir: "prev" | "next"; locale: Locale }) {
  const isNext = dir === "next";
  const amUi = locale === "am" ? "am" : "";
  return (
    <Link
      href={item.href}
      className={`group card-hover flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line hover:bg-[var(--accent-tint)] ${
        isNext ? "justify-between text-right sm:col-start-2" : ""
      }`}
    >
      {!isNext && <ArrowLeft className="size-5 shrink-0 text-faint transition-transform group-hover:-translate-x-1 group-hover:text-accent" aria-hidden />}
      <span className={`min-w-0 ${isNext ? "order-first flex-1" : "flex-1"} ${amUi}`}>
        <span className="block text-xs font-medium text-faint">
          {t(locale, isNext ? "nextLesson" : "prevLesson")} · {item.code}
        </span>
        <span className="block truncate font-semibold text-ink">{locale === "am" ? item.title_am : item.title_en}</span>
      </span>
      {isNext && <ArrowRight className="size-5 shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-accent" aria-hidden />}
    </Link>
  );
}
