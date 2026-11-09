"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpenText, Clock, ListChecks, Target } from "lucide-react";
import { useLang } from "@/lib/use-lang";
import { pick, ui } from "@/lib/i18n";
import type { LessonSection, LessonSummary, MainTopic } from "@/lib/types";
import type { QuizMeta } from "@/lib/data";
import { LanguageToggle } from "@/components/study/language-toggle";
import { NoteBlock } from "@/components/study/blocks";
import { MainTopics } from "@/components/study/main-topics";
import { SectionIcon } from "@/components/study/section-icon";
import { BiText } from "@/components/study/text";

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

type Tab = "notes" | "topics" | "quiz";
type NavLesson = { href: string; code: string; title_en: string; title_am: string } | null;

export function StudyView({
  lesson,
  sections,
  mainTopics,
  quiz,
  prev,
  next,
  unitLabel,
}: {
  lesson: LessonSummary;
  sections: LessonSection[];
  mainTopics: MainTopic[];
  quiz: QuizMeta | null;
  prev: NavLesson;
  next: NavLesson;
  unitLabel: string;
}) {
  const [lang, setLang] = useLang();
  const [tab, setTab] = useState<Tab>("notes");
  const [quizVisited, setQuizVisited] = useState(false);
  const [quizRunning, setQuizRunning] = useState(false);
  const am = lang === "am";

  const openTab = (t: Tab) => {
    setTab(t);
    if (t === "quiz") setQuizVisited(true);
  };

  const tabs: { id: Tab; label: string; icon: typeof BookOpenText }[] = [
    { id: "notes", label: ui("fullNotes", lang), icon: BookOpenText },
    { id: "topics", label: ui("mainTopics", lang), icon: ListChecks },
    { id: "quiz", label: ui("quiz", lang), icon: Target },
  ];

  return (
    <div>
      {/* Title */}
      <header className="mt-5">
        <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent-ink">
          <span className="tabular-nums">{lesson.code}</span>
          <span aria-hidden>·</span>
          <span className={am ? "am" : ""}>{pick(lesson.section_title_en, lesson.section_title_am, lang)}</span>
        </p>
        <h1 className={`mt-3 text-[1.7rem] leading-tight font-semibold tracking-tight text-ink sm:text-4xl ${am ? "am" : ""}`}>
          {pick(lesson.title_en, lesson.title_am, lang)}
        </h1>
        <p className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted ${am ? "am" : ""}`}>
          <span>{unitLabel}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {lesson.minutes} {ui("minutes", lang)}
          </span>
          {quiz && (
            <span className="inline-flex items-center gap-1">
              <Target className="size-3.5" aria-hidden />
              {quiz.questionCount} {ui("questions", lang)}
            </span>
          )}
        </p>
      </header>

      {/* Controls */}
      <div className="sticky top-14 z-20 -mx-4 mt-5 border-b border-line/70 bg-paper/90 px-4 py-3 backdrop-blur-md sm:top-16 sm:mx-0 sm:rounded-b-2xl sm:px-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AnimatePresence initial={false} mode="wait">
            {quizRunning ? (
              <motion.p
                key="focus"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`flex h-11 items-center gap-2 text-sm font-medium text-muted ${am ? "am" : ""}`}
              >
                <Target className="size-4 text-accent" aria-hidden />
                {ui("focusMode", lang)} · {ui("notesHidden", lang)}
              </motion.p>
            ) : (
              <motion.div
                key="tabs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                role="tablist"
                aria-label="Study mode"
                className="no-scrollbar flex overflow-x-auto rounded-full border border-line bg-surface p-1"
              >
                {tabs.map(({ id, label, icon: Icon }) => {
                  const active = tab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      id={`tab-${id}`}
                      aria-selected={active}
                      aria-controls={`panel-${id}`}
                      onClick={() => openTab(id)}
                      className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:flex-none sm:px-4 ${
                        active ? "text-white" : "text-muted hover:text-ink"
                      } ${am ? "am leading-normal" : ""}`}
                    >
                      {active && (
                        <motion.span
                          layoutId="tab-pill"
                          className="absolute inset-0 rounded-full bg-accent"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        />
                      )}
                      <Icon className="relative size-4" aria-hidden />
                      <span className="relative">{label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
          <LanguageToggle lang={lang} onChange={setLang} />
        </div>
      </div>

      {/* Panels */}
      <div className="mt-6">
        <AnimatePresence mode="wait" initial={false}>
          {tab === "notes" && (
            <motion.div
              key="notes"
              id="panel-notes"
              role="tabpanel"
              aria-labelledby="tab-notes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]"
            >
              <div className="min-w-0 space-y-6">
                {sections.map((s, i) => (
                  <section
                    key={s.id}
                    id={`part-${i + 1}`}
                    className="scroll-mt-40 rounded-2xl border border-line bg-surface px-4 py-6 sm:px-7 sm:py-7"
                  >
                    <h2 className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                        <SectionIcon name={s.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold tracking-wider text-faint uppercase">
                          {am ? <span className="am normal-case">ክፍል {i + 1}</span> : `Part ${i + 1}`}
                        </span>
                        <span className={`block text-lg leading-snug font-semibold text-ink sm:text-xl ${am ? "am" : ""}`}>
                          <BiText value={{ en: s.title_en, am: s.title_am }} lang={lang} single />
                        </span>
                      </span>
                    </h2>
                    <div className="mt-4">
                      {s.blocks.map((b, j) => (
                        <NoteBlock key={j} block={b} lang={lang} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <aside className="hidden lg:block">
                <nav aria-label={ui("onThisPage", lang)} className="sticky top-40">
                  <p className={`text-xs font-semibold tracking-wider text-faint uppercase ${am ? "am normal-case" : ""}`}>
                    {ui("onThisPage", lang)}
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
                          className={`-ml-px block border-l-2 border-transparent py-1.5 pl-3 text-sm text-muted transition-colors hover:border-accent hover:text-ink ${am ? "am" : ""}`}
                        >
                          {pick(s.title_en, s.title_am, lang)}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </aside>
            </motion.div>
          )}

          {tab === "topics" && (
            <motion.div
              key="topics"
              id="panel-topics"
              role="tabpanel"
              aria-labelledby="tab-topics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <MainTopics topics={mainTopics} lang={lang} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quiz stays mounted once opened so progress survives tab switches. */}
        {quizVisited && (
          <div id="panel-quiz" role="tabpanel" aria-labelledby="tab-quiz" hidden={tab !== "quiz"}>
            {quiz ? (
              <Quiz quiz={quiz} lang={lang} onRunningChange={setQuizRunning} onBackToNotes={() => openTab("notes")} />
            ) : (
              <p className={`py-12 text-center text-muted ${am ? "am" : ""}`}>{ui("noQuiz", lang)}</p>
            )}
          </div>
        )}
      </div>

      {/* Previous / next lesson (hidden in focus mode) */}
      {!quizRunning && (prev || next) && (
        <nav aria-label="Lesson navigation" className="mt-12 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <LessonLink item={prev} dir="prev" lang={lang} />
          ) : (
            <span className="hidden sm:block" />
          )}
          {next && <LessonLink item={next} dir="next" lang={lang} />}
        </nav>
      )}
    </div>
  );
}

function LessonLink({ item, dir, lang }: { item: NonNullable<NavLesson>; dir: "prev" | "next"; lang: ReturnType<typeof useLang>[0] }) {
  const am = lang === "am";
  const isNext = dir === "next";
  return (
    <Link
      href={item.href}
      className={`group card-hover flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-[color:var(--accent)] hover:bg-[var(--accent-tint)] ${
        isNext ? "justify-between text-right sm:col-start-2" : ""
      }`}
    >
      {!isNext && <ArrowLeft className="size-5 shrink-0 text-faint transition-transform group-hover:-translate-x-1 group-hover:text-accent" aria-hidden />}
      <span className={`min-w-0 ${isNext ? "order-first flex-1" : "flex-1"}`}>
        <span className={`block text-xs font-medium text-faint ${am ? "am" : ""}`}>
          {ui(isNext ? "nextLesson" : "prevLesson", lang)} · {item.code}
        </span>
        <span className={`block truncate font-semibold text-ink ${am ? "am" : ""}`}>{pick(item.title_en, item.title_am, lang)}</span>
      </span>
      {isNext && <ArrowRight className="size-5 shrink-0 text-faint transition-transform group-hover:translate-x-1 group-hover:text-accent" aria-hidden />}
    </Link>
  );
}
