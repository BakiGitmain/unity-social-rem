"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, RotateCw, Sparkles } from "lucide-react";
import { useUser } from "@/components/user-provider";
import { NoteMarkdown } from "@/components/notes/note-markdown";
import { dueCards, listBoards, rateCard, type Flashcard } from "@/lib/notes/client";
import { previewInterval, type Rating } from "@/lib/notes/srs";
import { notifyDue } from "@/lib/notes/use-due";
import type { Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";

/**
 * Flashcard review (spaced repetition, SM-2): one board (?board=), one lesson (?lesson=) or everything due.
 * Flip with a 3D animation, then rate Again / Hard / Good / Easy.
 */
export function Review({ locale }: { locale: Locale }) {
  const { username, loading } = useUser();
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [scope, setScope] = useState<{ board?: string; lesson?: string }>({});
  const am = locale === "am";
  const tr = (k: Parameters<typeof t>[1], v?: Record<string, string | number>) => t(locale, k, v);

  useEffect(() => {
    if (loading) return;
    const p = new URLSearchParams(window.location.search);
    const sc = { board: p.get("board") ?? undefined, lesson: p.get("lesson") ?? undefined };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScope(sc);
    void (async () => {
      let boardIds: string[] | undefined;
      if (sc.board) boardIds = [sc.board];
      else if (sc.lesson) boardIds = (await listBoards(!!username)).filter((b) => b.lesson_id === sc.lesson).map((b) => b.id);
      const list = await dueCards(!!username, { boardIds });
      setCards(boardIds && !boardIds.length ? [] : list);
    })();
  }, [loading, username]);

  const card = cards?.[i];
  const rate = async (r: Rating) => {
    if (!card) return;
    await rateCard(card, r).catch(() => {});
    setFlipped(false);
    setDone((d) => d + 1);
    // "again" comes back at the end of this session
    setTimeout(() => {
      if (r === "again") setCards((cs) => (cs ? [...cs, cs[i]!] : cs));
      setI((x) => x + 1);
    }, 180);
    notifyDue();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) void rate((["again", "hard", "good", "easy"] as Rating[])[Number(e.key) - 1]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const total = cards?.length ?? 0;
  const back = scope.board ? `/notes/board?id=${scope.board}` : "/notes";
  const ratings = useMemo(
    () =>
      [
        ["again", tr("again"), "bg-bad-soft text-bad"],
        ["hard", tr("hard"), "bg-tip-soft text-tip"],
        ["good", tr("goodR"), "bg-accent-soft text-accent-ink"],
        ["easy", tr("easy"), "bg-good-soft text-good"],
      ] as const,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  return (
    <div className={`mx-auto max-w-xl ${am ? "am" : ""}`}>
      <Link href={back} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {tr("myNotes")}
      </Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-ink">
        <Sparkles className="size-6 text-accent" aria-hidden /> {tr("review")}
      </h1>
      {cards === null ? (
        <div className="skeleton mt-6 h-72 rounded-3xl" />
      ) : !card ? (
        <div className="mt-10 rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <p className="text-xl font-semibold text-ink">{total ? tr("allDone") : tr("nothingDue")}</p>
          {done > 0 && <p className="mt-2 text-muted">{done} ✓</p>}
          <Link href={back} className="mt-6 inline-block rounded-full bg-accent px-6 py-2.5 font-medium text-white">
            {tr("myNotes")}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={i}>
            <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${(i / total) * 100}%` }} />
          </div>
          <p className="mt-2 text-right text-xs text-muted tabular-nums">
            {i + 1} / {total}
          </p>
          <AnimatePresence mode="wait">
            <motion.div key={`${card.id}-${i}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} className="flip-card mt-3">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                aria-label={flipped ? "Show the question" : tr("showAnswer")}
                className={`flip-inner grid h-72 w-full text-left ${flipped ? "flipped" : ""}`}
              >
                <div className="flip-face col-start-1 row-start-1 flex flex-col rounded-3xl bg-surface p-6 shadow-[0_10px_30px_-18px_rgba(29,42,44,0.4)] ring-1 ring-line">
                  <p className="text-xs font-semibold tracking-wide text-accent-ink uppercase">Question</p>
                  <div className="mt-3 flex-1 overflow-y-auto text-xl leading-snug font-semibold text-ink">
                    <NoteMarkdown text={card.front} />
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    <RotateCw className="size-4" aria-hidden /> {tr("showAnswer")}
                  </p>
                </div>
                <div className="flip-face flip-back col-start-1 row-start-1 flex flex-col rounded-3xl bg-accent-tint p-6 shadow-[0_10px_30px_-18px_rgba(29,42,44,0.4)] ring-1 ring-accent/20">
                  <p className="text-xs font-semibold tracking-wide text-accent-ink uppercase">Answer</p>
                  <div className="mt-3 flex-1 overflow-y-auto text-[17px] leading-relaxed text-ink">
                    <NoteMarkdown text={card.back || "—"} />
                  </div>
                </div>
              </button>
            </motion.div>
          </AnimatePresence>
          <div className="mt-4 grid grid-cols-4 gap-2" aria-hidden={!flipped}>
            {ratings.map(([r, label, cls], k) => (
              <button
                key={r}
                type="button"
                disabled={!flipped}
                onClick={() => void rate(r)}
                className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-sm font-semibold transition-opacity disabled:opacity-30 ${cls}`}
              >
                {label}
                <span className="text-[11px] font-normal opacity-80">
                  {previewInterval(card, r)} · {k + 1}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
