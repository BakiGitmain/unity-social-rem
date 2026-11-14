"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ListRestart, NotebookText, RotateCcw, Target, X, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { t as tr, type SiteKey } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";
import { recordQuizScore } from "@/lib/progress";
import { track } from "@/lib/track";
import { usePinBar } from "@/lib/bar-pin";
import type { Lang, QuizQuestion } from "@/lib/types";
import type { QuizMeta } from "@/lib/data";
import { MathText, texToPlain } from "@/components/math/tex";
import { correctAnswerText, describeAnswer, type FieldResult, type FieldSpec } from "@/components/math/answer-field";
import { QuestionCard as UnifiedCard } from "@/components/questions/question-card";
import { fromQuiz } from "@/lib/questions";

/** How a question is answered: multiple choice, number, set or "shade the Venn diagram". */
function specOf(q: QuizQuestion, lang: "en" | "am"): FieldSpec {
  const kind = q.kind ?? "choice";
  if (kind === "number") return { kind, value: Number(q.answer?.value ?? 0) };
  if (kind === "set") return { kind, value: (q.answer?.value as string[]) ?? [] };
  if (kind === "venn") return { kind, venn: q.answer?.venn ?? { sets: 2 }, regions: q.answer?.regions ?? [] };
  return { kind: "choice", options: lang === "am" ? q.options_am : q.options_en, correct: q.correct_index };
}

type Phase = "intro" | "running" | "done" | "review";

/** Quiz tab. Loaded lazily; questions are fetched only when this tab is opened. */
export default function Quiz({
  quiz,
  lessonId,
  lang,
  locale,
  autoStartKey = 0,
  onRunningChange,
  onBackToNotes,
}: {
  quiz: QuizMeta;
  lessonId: string;
  lang: Lang;
  locale: Locale;
  /** Increase to jump straight into the quiz (e.g. from the "Lesson complete" screen). */
  autoStartKey?: number;
  onRunningChange: (running: boolean) => void;
  onBackToNotes: () => void;
}) {
  // In "both" mode only the notes change; the quiz stays English.
  const qLang: "en" | "am" = lang === "am" ? "am" : "en";
  const am = qLang === "am" || locale === "am";

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(FieldResult | null)[]>([]);
  const topRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);
  const [attempt, setAttempt] = useState(0);
  usePinBar(phase === "running"); // keep the mobile tab bar visible during the quiz

  const load = useCallback(async () => {
    setLoadError(false);
    const { data, error } = await createClient()
      .from("quiz_questions")
      .select("id, sort_order, kind, needs_calculation, answer, steps, guide, question_en, question_am, options_en, options_am, correct_index, explanation_en, explanation_am")
      .eq("quiz_id", quiz.id)
      .order("sort_order");
    if (error || !data) setLoadError(true);
    else setQuestions(data as QuizQuestion[]);
  }, [quiz.id]);

  useEffect(() => {
    // Fetching on mount is the point: the quiz loads only when its tab opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const go = (p: Phase) => {
    setPhase(p);
    onRunningChange(p === "running");
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const start = () => {
    if (!questions) return;
    setAnswers(Array(questions.length).fill(null));
    setIndex(0);
    startedAt.current = Date.now();
    setAttempt(startedAt.current);
    track({ type: "quiz_start", lessonId });
    go("running");
  };

  const cancel = () => go("intro");

  // "Start Quiz" on the finished screen: begin as soon as the questions are loaded.
  const handledKey = useRef(0);
  useEffect(() => {
    if (!autoStartKey || autoStartKey === handledKey.current || !questions) return;
    handledKey.current = autoStartKey;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartKey, questions]);

  const finish = () => {
    if (questions) {
      const s = answers.filter((a) => a?.correct).length;
      recordQuizScore(lessonId, s, questions.length);
      // The server recomputes the score from these answers (per-question analytics).
      track({
        type: "quiz_attempt",
        lessonId,
        answers: questions.map((q, i) => ({ question_id: q.id, chosen: answers[i]?.chosen ?? null, value: answers[i]?.value ?? null })),
        durationMs: Date.now() - startedAt.current,
      });
    }
    go("done");
  };

  const t = (k: SiteKey) => tr(locale, k);
  const total = questions?.length ?? quiz.questionCount;
  const score = answers.filter((a) => a?.correct).length;

  return (
    // pb on phones: the last answer options and "Next" can always scroll above the floating bottom bar
    <div ref={topRef} className="scroll-mt-24 pb-24 md:pb-0">
      <AnimatePresence mode="wait" initial={false}>
        {phase === "intro" && (
          <Panel key="intro">
            <div className="mx-auto max-w-xl rounded-3xl border border-line bg-surface px-6 py-10 text-center sm:px-10">
              <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Target className="size-8" aria-hidden />
              </span>
              <h2 className={`mt-5 text-xl font-semibold text-ink ${am ? "am" : ""}`}>{am ? quiz.title_am : quiz.title_en}</h2>
              <p className={`mt-2 text-muted ${am ? "am" : ""}`}>{am ? quiz.description_am : quiz.description_en}</p>
              <p className={`mt-4 text-sm text-faint ${am ? "am" : ""}`}>{t("quizIntro")}</p>

              {loadError ? (
                <div className="mt-8">
                  <p className={`text-sm text-bad ${am ? "am" : ""}`}>{t("quizError")}</p>
                  <button type="button" onClick={load} className="mt-3 rounded-full border border-line px-4 py-2 text-sm font-medium">
                    {t("retry")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={start}
                  disabled={!questions}
                  className={`mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 font-medium text-white transition-[transform,opacity] active:translate-y-0 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0 ${am ? "am" : ""}`}
                >
                  {questions ? (
                    <>
                      {t("startQuiz")} · {total} {t("questions")}
                      <ArrowRight className="size-4" aria-hidden />
                    </>
                  ) : (
                    <>
                      <span className="spinner !border-white/30 !border-t-white" aria-hidden />
                      {t("loadingQuiz")}
                    </>
                  )}
                </button>
              )}
            </div>
          </Panel>
        )}

        {phase === "running" && questions && (
          <Panel key="running">
            <FocusBar am={am} label={t("focusMode")} hint={t("notesHidden")} cancel={t("cancelQuiz")} onCancel={cancel} />
            <QuestionCard
              key={questions[index].id}
              q={questions[index]}
              number={index + 1}
              total={questions.length}
              result={answers[index] ?? null}
              lang={qLang}
              t={t}
              onAnswer={(r) => setAnswers((a) => a.map((v, k) => (k === index ? r : v)))}
              onNext={() => (index + 1 < questions.length ? setIndex(index + 1) : finish())}
              isLast={index + 1 === questions.length}
              attempt={attempt}
            />
          </Panel>
        )}

        {phase === "done" && questions && (
          <Panel key="done">
            <ScoreScreen
              score={score}
              total={questions.length}
              am={am}
              t={t}
              onReview={() => go("review")}
              onRetry={start}
              onNotes={() => {
                go("intro");
                onBackToNotes();
              }}
            />
          </Panel>
        )}

        {phase === "review" && questions && (
          <Panel key="review">
            <Review questions={questions} answers={answers} lang={qLang} t={t} onBack={() => go("done")} onRetry={start} />
          </Panel>
        )}
      </AnimatePresence>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function FocusBar({ am, label, hint, cancel, onCancel }: { am: boolean; label: string; hint: string; cancel: string; onCancel: () => void }) {
  return (
    <div className={`mx-auto mb-5 flex max-w-2xl items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white ${am ? "am" : ""}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <Eye className="size-4 shrink-0 text-[#9fe0d4]" aria-hidden />
        <p className="truncate text-sm">
          <span className="font-semibold">{label}</span>
          <span className="hidden text-white/70 sm:inline"> · {hint}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/20"
      >
        <X className="size-4" aria-hidden />
        {cancel}
      </button>
    </div>
  );
}

function QuestionCard({
  q,
  number,
  total,
  result,
  lang,
  t,
  onAnswer,
  onNext,
  isLast,
  attempt,
}: {
  q: QuizQuestion;
  number: number;
  total: number;
  result: FieldResult | null;
  lang: "en" | "am";
  t: (k: SiteKey) => string;
  onAnswer: (r: FieldResult) => void;
  onNext: () => void;
  isLast: boolean;
  /** Each attempt starts with a clean answer paper. */
  attempt: number;
}) {
  const am = lang === "am";
  const answered = result !== null;
  const right = !!result?.correct;
  const nextRef = useRef<HTMLButtonElement>(null);
  const spec = specOf(q, lang);

  useEffect(() => {
    if (answered) nextRef.current?.focus({ preventScroll: true });
  }, [answered]);

  return (
    <div className={`mx-auto max-w-2xl ${am ? "am" : ""}`}>
      {/* progress */}
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {t("question")} {number} {t("of")} {total}
        </span>
        <span className="tabular-nums">{Math.round(((number - 1 + (answered ? 1 : 0)) / total) * 100)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={number - 1 + (answered ? 1 : 0)}>
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: `${((number - 1) / total) * 100}%` }}
          animate={{ width: `${((number - 1 + (answered ? 1 : 0)) / total) * 100}%` }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} className="mt-6">
        <UnifiedCard
          q={fromQuiz(q, lang)}
          kicker={`${t("question")} ${number}`}
          lang={lang}
          mode="quiz"
          paperKey={`quiz:${q.id}:${attempt}`}
          checkLabel={t("check")}
          saved={result ? { 0: result } : {}}
          onPart={(_, r) => onAnswer(r)}
          after={
            <>
              {!right && spec.kind !== "choice" && (
                <p className="mt-3 text-sm text-ink/90">
                  <span className="font-medium">{t("correctAnswer")}: </span>
                  <MathText text={correctAnswerText(spec)} />
                </p>
              )}
              <div className="mt-5 flex justify-end">
                <button
                  ref={nextRef}
                  type="button"
                  onClick={onNext}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 font-medium text-white transition-transform active:translate-y-0"
                >
                  {t(isLast ? "seeResults" : "nextQuestion")}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
            </>
          }
        />
      </motion.div>
    </div>
  );
}

/** Step-by-step explanation (shown after answering). */
function Steps({ q, lang }: { q: QuizQuestion; lang: "en" | "am" }) {
  if (!q.steps?.length) return null;
  return (
    <ol className="font-hand mt-3 space-y-1 rounded-xl bg-white/70 px-4 py-2.5 text-[16px] leading-7 text-[#23324a]">
      {q.steps.map((s, i) => (
        <li key={i} className="flex gap-2">
          <span className="shrink-0 text-[#c05050]/80">{i + 1}.</span>
          <span className="min-w-0">
            <MathText text={lang === "am" ? s.text.am : s.text.en} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function ScoreScreen({
  score,
  total,
  am,
  t,
  onReview,
  onRetry,
  onNotes,
}: {
  score: number;
  total: number;
  am: boolean;
  t: (k: SiteKey) => string;
  onReview: () => void;
  onRetry: () => void;
  onNotes: () => void;
}) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = pct >= 80 ? "var(--good)" : pct >= 50 ? "var(--accent)" : "var(--tip)";
  const message = pct >= 80 ? t("excellent") : pct >= 50 ? t("good") : t("keepGoing");

  return (
    <div className={`mx-auto max-w-xl rounded-3xl border border-line bg-surface px-6 py-10 text-center sm:px-10 ${am ? "am" : ""}`}>
      <p className="text-sm font-medium text-muted">{t("yourScore")}</p>
      <div className="relative mx-auto mt-4 size-36">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
          <motion.circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (pct / 100) * c }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div>
            <p className="text-3xl font-semibold text-ink tabular-nums">
              {score}/{total}
            </p>
            <p className="text-sm text-muted tabular-nums">{pct}%</p>
          </div>
        </div>
      </div>
      <p className="mt-5 text-lg font-medium text-ink">{message}</p>
      <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        {score < total && (
          <button type="button" onClick={onReview} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-white">
            <ListRestart className="size-4" aria-hidden />
            {t("reviewMistakes")}
          </button>
        )}
        <button type="button" onClick={onRetry} className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-medium text-ink hover:border-line-strong">
          <RotateCcw className="size-4" aria-hidden />
          {t("tryAgain")}
        </button>
        <button type="button" onClick={onNotes} className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-medium text-ink hover:border-line-strong">
          <NotebookText className="size-4" aria-hidden />
          {t("backToNotes")}
        </button>
      </div>
    </div>
  );
}

function Review({
  questions,
  answers,
  lang,
  t,
  onBack,
  onRetry,
}: {
  questions: QuizQuestion[];
  answers: (FieldResult | null)[];
  lang: "en" | "am";
  t: (k: SiteKey) => string;
  onBack: () => void;
  onRetry: () => void;
}) {
  const am = lang === "am";
  const wrong = questions.map((q, i) => ({ q, i, a: answers[i] ?? null })).filter(({ a }) => !a?.correct);

  return (
    <div className={`mx-auto max-w-2xl ${am ? "am" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          {t("yourScore")}
        </button>
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium text-ink">
          <RotateCcw className="size-4" aria-hidden />
          {t("tryAgain")}
        </button>
      </div>
      <h2 className="mt-5 text-xl font-semibold text-ink">{t("reviewMistakes")}</h2>
      {wrong.length === 0 && <p className="mt-4 text-muted">{t("noMistakes")}</p>}
      <ol className="mt-5 space-y-4">
        {wrong.map(({ q, i, a }) => {
          const spec = specOf(q, lang);
          return (
            <li key={q.id} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm text-faint">
                {t("question")} {i + 1}
              </p>
              <p className="mt-1 font-semibold text-ink">
                <MathText text={am ? q.question_am : q.question_en} />
              </p>
              <div className="mt-3 space-y-2 text-sm">
                {a && (
                  <p className="flex gap-2 rounded-xl bg-bad-soft px-3 py-2">
                    <X className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                    <span>
                      <span className="font-medium text-bad">{t("yourAnswer")}: </span>
                      <MathText text={describeAnswer(spec, a)} />
                    </span>
                  </p>
                )}
                <p className="flex gap-2 rounded-xl bg-good-soft px-3 py-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                  <span>
                    <span className="font-medium text-good">{t("correctAnswer")}: </span>
                    <MathText text={correctAnswerText(spec)} />
                  </span>
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                <MathText text={am ? q.explanation_am : q.explanation_en} />
              </p>
              <Steps q={q} lang={lang} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
