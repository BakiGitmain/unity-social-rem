"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ListRestart, NotebookText, RotateCcw, Target, X, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/i18n";
import type { Lang, QuizQuestion } from "@/lib/types";
import type { QuizMeta } from "@/lib/data";

type Phase = "intro" | "running" | "done" | "review";

/** Quiz tab. Loaded lazily; questions are fetched only when this tab is opened. */
export default function Quiz({
  quiz,
  lang,
  onRunningChange,
  onBackToNotes,
}: {
  quiz: QuizMeta;
  lang: Lang;
  onRunningChange: (running: boolean) => void;
  onBackToNotes: () => void;
}) {
  // In "both" mode only the notes change; the quiz stays English.
  const qLang: "en" | "am" = lang === "am" ? "am" : "en";
  const am = qLang === "am";

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    const { data, error } = await createClient()
      .from("quiz_questions")
      .select("id, sort_order, question_en, question_am, options_en, options_am, correct_index, explanation_en, explanation_am")
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
    go("running");
  };

  const cancel = () => go("intro");

  const t = (k: Parameters<typeof ui>[0]) => ui(k, qLang);
  const total = questions?.length ?? quiz.questionCount;
  const score = questions ? answers.filter((a, i) => a === questions[i].correct_index).length : 0;

  return (
    <div ref={topRef} className="scroll-mt-24">
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
              chosen={answers[index]}
              lang={qLang}
              onChoose={(i) => setAnswers((a) => a.map((v, k) => (k === index ? i : v)))}
              onNext={() => (index + 1 < questions.length ? setIndex(index + 1) : go("done"))}
              isLast={index + 1 === questions.length}
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
  chosen,
  lang,
  onChoose,
  onNext,
  isLast,
}: {
  q: QuizQuestion;
  number: number;
  total: number;
  chosen: number | null;
  lang: "en" | "am";
  onChoose: (i: number) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const am = lang === "am";
  const options = am ? q.options_am : q.options_en;
  const answered = chosen !== null;
  const right = chosen === q.correct_index;
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (answered) nextRef.current?.focus({ preventScroll: true });
  }, [answered]);

  return (
    <div className={`mx-auto max-w-2xl ${am ? "am" : ""}`}>
      {/* progress */}
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {ui("question", lang)} {number} {ui("of", lang)} {total}
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

      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-7"
      >
        <h2 className="text-lg leading-snug font-semibold text-ink sm:text-xl">{am ? q.question_am : q.question_en}</h2>

        <ul className="mt-5 space-y-2.5">
          {options.map((opt, i) => {
            const isCorrect = i === q.correct_index;
            const isChosen = i === chosen;
            let state = "border-line bg-surface hover:border-[color:var(--accent)] hover:bg-[var(--accent-tint)]";
            if (answered) {
              if (isCorrect) state = "border-good bg-good-soft";
              else if (isChosen) state = "border-bad bg-bad-soft";
              else state = "border-line bg-surface opacity-60";
            }
            return (
              <li key={i}>
                <motion.button
                  type="button"
                  disabled={answered}
                  onClick={() => onChoose(i)}
                  animate={answered && isChosen && !isCorrect ? { x: [0, -6, 6, -4, 4, 0] } : answered && isCorrect ? { scale: [1, 1.015, 1] } : {}}
                  transition={{ duration: 0.4 }}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${state}`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold ${
                      answered && isCorrect
                        ? "bg-good text-white"
                        : answered && isChosen
                          ? "bg-bad text-white"
                          : "bg-paper text-muted"
                    }`}
                  >
                    {answered && isCorrect ? <Check className="size-4" aria-hidden /> : answered && isChosen ? <X className="size-4" aria-hidden /> : String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 text-ink">{opt}</span>
                </motion.button>
              </li>
            );
          })}
        </ul>

        <AnimatePresence>
          {answered && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className={`mt-5 rounded-2xl px-4 py-3.5 ${right ? "bg-good-soft" : "bg-bad-soft"}`} role="status" aria-live="polite">
                <p className={`flex items-center gap-2 font-semibold ${right ? "text-good" : "text-bad"}`}>
                  {right ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                  {ui(right ? "correct" : "incorrect", lang)}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/90">
                  <span className="font-medium">{ui("explanation", lang)}: </span>
                  {am ? q.explanation_am : q.explanation_en}
                </p>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  ref={nextRef}
                  type="button"
                  onClick={onNext}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 font-medium text-white transition-transform active:translate-y-0"
                >
                  {ui(isLast ? "seeResults" : "nextQuestion", lang)}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
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
  t: (k: Parameters<typeof ui>[0]) => string;
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
  answers: (number | null)[];
  lang: "en" | "am";
  t: (k: Parameters<typeof ui>[0]) => string;
  onBack: () => void;
  onRetry: () => void;
}) {
  const am = lang === "am";
  const wrong = questions.map((q, i) => ({ q, i, a: answers[i] })).filter(({ q, a }) => a !== q.correct_index);

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
          const opts = am ? q.options_am : q.options_en;
          return (
            <li key={q.id} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm text-faint">
                {t("question")} {i + 1}
              </p>
              <p className="mt-1 font-semibold text-ink">{am ? q.question_am : q.question_en}</p>
              <div className="mt-3 space-y-2 text-sm">
                {a !== null && (
                  <p className="flex gap-2 rounded-xl bg-bad-soft px-3 py-2">
                    <X className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                    <span>
                      <span className="font-medium text-bad">{t("yourAnswer")}: </span>
                      {opts[a]}
                    </span>
                  </p>
                )}
                <p className="flex gap-2 rounded-xl bg-good-soft px-3 py-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                  <span>
                    <span className="font-medium text-good">{t("correctAnswer")}: </span>
                    {opts[q.correct_index]}
                  </span>
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{am ? q.explanation_am : q.explanation_en}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
