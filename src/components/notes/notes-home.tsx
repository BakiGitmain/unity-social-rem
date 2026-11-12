"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronRight, CloudUpload, Plus, RotateCcw, Search, Sparkles, Trash2 } from "lucide-react";
import { useUser } from "@/components/user-provider";
import { LessonBoardsSheet, type LessonRef } from "@/components/notes/lesson-boards";
import { BOARD_COLOURS, BoardIcon } from "@/components/notes/board-icon";
import { deleteBoardForever, dueCount, listAllNodes, listBoards, localBoards, purgeOld, restoreBoard, uploadLocalBoards } from "@/lib/notes/client";
import { cardText, type Board, type BoardNode } from "@/lib/notes/types";
import { COLOR_BG } from "@/components/notes/card-node";
import { subjectStyle } from "@/lib/subjects";
import type { NotesLesson } from "@/lib/data";
import type { Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";

const spring = { type: "spring", stiffness: 420, damping: 36 } as const;

/** /notes: search, recent boards, due flashcards, subjects → lessons → boards, recently deleted. */
export function NotesHome({ lessons, subjects: allSubjects, locale }: { lessons: NotesLesson[]; subjects: NotesLesson["subject"][]; locale: Locale }) {
  const { username, loading } = useUser();
  const loggedIn = !!username;
  const am = locale === "am";
  const tr = (k: Parameters<typeof t>[1], v?: Record<string, string | number>) => t(locale, k, v);
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [cards, setCards] = useState<{ boardId: string; node: BoardNode }[]>([]);
  const [deleted, setDeleted] = useState<Board[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [due, setDue] = useState(0);
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [sheetLesson, setSheetLesson] = useState<LessonRef | null>(null);
  const [toUpload, setToUpload] = useState(0);
  const [confirm, setConfirm] = useState<Board | null>(null);

  const load = useCallback(async () => {
    const [bs, ds, n, d] = await Promise.all([listBoards(loggedIn), listBoards(loggedIn, { deleted: true }), listAllNodes(loggedIn), dueCount(loggedIn)]);
    setBoards(bs);
    setDeleted(ds);
    setCards(n);
    setDue(d);
    if (loggedIn) setToUpload((await localBoards()).length);
  }, [loggedIn]);

  useEffect(() => {
    if (loading) return;
    void purgeOld(loggedIn).finally(() => void load());
    const s = new URLSearchParams(window.location.search).get("subject");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s) setSubject(s);
  }, [loading, loggedIn, load]);

  const pickSubject = (slug: string | null) => {
    setSubject(slug);
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("subject", slug);
    else url.searchParams.delete("subject");
    window.history.replaceState(null, "", url);
  };

  const byLesson = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);
  const nodesByBoard = useMemo(() => {
    const m = new Map<string, BoardNode[]>();
    for (const c of cards) m.set(c.boardId, [...(m.get(c.boardId) ?? []), c.node]);
    return m;
  }, [cards]);
  const subjects = useMemo(() => {
    // all 4 subjects, even before they have lessons
    const seen = new Map<string, NotesLesson["subject"] & { boards: number }>(allSubjects.map((x) => [x.slug, { ...x, boards: 0 }]));
    for (const l of lessons) if (!seen.has(l.subject.slug)) seen.set(l.subject.slug, { ...l.subject, boards: 0 });
    for (const b of boards ?? []) {
      const l = byLesson.get(b.lesson_id);
      if (l) seen.get(l.subject.slug)!.boards++;
    }
    return [...seen.values()];
  }, [lessons, boards, byLesson, allSubjects]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const bmap = new Map((boards ?? []).map((b) => [b.id, b]));
    const out: { board: Board; node?: BoardNode; text: string }[] = [];
    for (const b of boards ?? []) if (b.title.toLowerCase().includes(s)) out.push({ board: b, text: b.title });
    for (const c of cards) {
      const b = bmap.get(c.boardId);
      if (!b) continue;
      const text = cardText(c.node);
      const i = text.toLowerCase().indexOf(s);
      if (i >= 0) out.push({ board: b, node: c.node, text: text.slice(Math.max(0, i - 40), i + 80) });
    }
    return out.slice(0, 40);
  }, [q, boards, cards]);

  const lessonName = (l: NotesLesson) => `${l.code} ${am ? l.title_am : l.title_en}`;
  const ref = (l: NotesLesson): LessonRef => ({ id: l.id, subjectId: l.subject.id, code: l.code, title: am ? l.title_am : l.title_en });
  const recent = (boards ?? []).slice(0, 10);

  if (boards === null) return <NotesHomeSkeleton />;

  return (
    <div className={am ? "am" : ""}>
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{tr("myNotes")}</h1>
      <p className="mt-1 text-muted">{tr("notesSub")}</p>

      {!loggedIn && (
        <p className="mt-4 rounded-2xl bg-tip-soft px-4 py-3 text-sm text-tip">
          {tr("loginToKeepNotes")}{" "}
          <Link href="/login?next=/notes" className="font-semibold underline">
            {tr("login")}
          </Link>
        </p>
      )}
      {loggedIn && toUpload > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-note-soft px-4 py-3 text-sm text-note">
          <CloudUpload className="size-5" aria-hidden />
          <span className="flex-1">{tr("uploadLocal", { n: toUpload })}</span>
          <button
            type="button"
            onClick={async () => {
              await uploadLocalBoards();
              setToUpload(0);
              void load();
            }}
            className="rounded-full bg-note px-4 py-2 font-medium text-white"
          >
            {tr("upload")}
          </button>
        </div>
      )}

      {/* search */}
      <label className="relative mt-5 block">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("searchNotes")}
          aria-label={tr("searchNotes")}
          className="h-12 w-full rounded-2xl bg-surface pr-4 pl-12 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent/50"
        />
      </label>
      <AnimatePresence>
        {results.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="mt-2 overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
            {results.map((r, i) => (
              <li key={`${r.board.id}-${r.node?.id ?? "b"}-${i}`} className="border-b border-line last:border-0">
                <Link href={`/notes/board?id=${r.board.id}${r.node ? `&card=${r.node.id}` : ""}`} className="block px-4 py-2.5 hover:bg-ink/[0.03]">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-accent-ink">
                    <BoardIcon icon={r.board.emoji} colour={r.board.colour} size={20} className="!rounded-md" />
                    {r.board.title}
                  </span>
                  <span className="block truncate text-sm text-ink/85">{r.text}</span>
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* due flashcards */}
      {due > 0 && (
        <Link href="/notes/review" className="mt-5 flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3 ring-1 ring-accent/20">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-white">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <span className="flex-1 font-medium text-accent-ink">{due === 1 ? tr("dueOne") : tr("dueToday", { n: due })}</span>
          <span className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">{tr("reviewNow")}</span>
        </Link>
      )}

      {/* recent boards */}
      {recent.length > 0 && !subject && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{tr("recentBoards")}</h2>
          <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {recent.map((b) => {
              const l = byLesson.get(b.lesson_id);
              return (
                <li key={b.id} className="w-56 shrink-0">
                  <Link href={`/notes/board?id=${b.id}`} className="card-hover block overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
                    <BoardThumb nodes={nodesByBoard.get(b.id) ?? []} colour={BOARD_COLOURS[b.colour] ?? "#0f766e"} />
                    <div className="p-3">
                      <p className="flex items-center gap-2 font-semibold text-ink">
                        <BoardIcon icon={b.emoji} colour={b.colour} size={28} className="!rounded-lg" />
                        <span className="truncate">{b.title}</span>
                      </p>
                      {l && <p className="truncate text-xs text-muted">{am ? l.subject.name_am : l.subject.name_en} · {l.code}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* subjects → lessons → boards */}
      {!subject ? (
        <section className="mt-8">
          <div className="grid gap-3 sm:grid-cols-2">
            {subjects.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => pickSubject(s.slug)}
                style={subjectStyle(s.slug, s.color)}
                className="card-hover flex items-center gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-line"
              >
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[var(--accent-tint)]">
                  <Image src={`/illustrations/subjects/${s.slug}.svg`} alt="" width={48} height={48} className="size-12 object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{am ? s.name_am : s.name_en}</span>
                  <span className="text-sm text-accent-ink">{s.boards === 1 ? tr("board1") : tr("boardN", { n: s.boards })}</span>
                </span>
                <ChevronRight className="size-5 text-faint" aria-hidden />
              </button>
            ))}
          </div>
          {!boards.length && (
            <div className="mt-10 text-center">
              <Image src="/illustrations/notes/notes.svg" alt="" width={248} height={160} className="mx-auto h-40 w-[248px]" />
              <p className="mt-4 text-lg font-semibold text-ink">{tr("noBoardsYet")}</p>
              <p className="mt-1 text-muted">{tr("noBoardsHint")}</p>
              <p className="mt-6 text-xs text-faint">
                Illustration:{" "}
                <a href="https://undraw.co" target="_blank" rel="noreferrer" className="underline">
                  unDraw
                </a>{" "}
                (free licence)
              </p>
            </div>
          )}
        </section>
      ) : (
        <SubjectLessons
          slug={subject}
          name={(() => {
            const x = subjects.find((v) => v.slug === subject);
            return x ? (am ? x.name_am : x.name_en) : subject;
          })()}
          lessons={lessons.filter((l) => l.subject.slug === subject)}
          boards={boards}
          am={am}
          locale={locale}
          onBack={() => pickSubject(null)}
          onNew={(l) => setSheetLesson(ref(l))}
          lessonName={lessonName}
        />
      )}

      {/* recently deleted */}
      {deleted.length > 0 && (
        <section className="mt-10">
          <button type="button" onClick={() => setShowDeleted((s) => !s)} className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink" aria-expanded={showDeleted}>
            <Trash2 className="size-4" aria-hidden /> {tr("recentlyDeleted")} ({deleted.length})
          </button>
          <AnimatePresence>
            {showDeleted && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <p className="mt-2 text-xs text-faint">{tr("recentlyDeletedHint")}</p>
                <ul className="mt-2 space-y-1.5">
                  {deleted.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 ring-1 ring-line">
                      <BoardIcon icon={b.emoji} colour={b.colour} size={28} className="!rounded-lg" />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{b.title}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await restoreBoard(b, loggedIn);
                          void load();
                        }}
                        className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-accent-ink hover:bg-accent-soft"
                      >
                        <RotateCcw className="size-4" aria-hidden /> {tr("restore")}
                      </button>
                      <button type="button" onClick={() => setConfirm(b)} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-bad hover:bg-bad-soft">
                        <Trash2 className="size-4" aria-hidden /> {tr("deleteForever")}
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {sheetLesson && <LessonBoardsSheet lesson={sheetLesson} locale={locale} open={!!sheetLesson} onClose={() => setSheetLesson(null)} />}
      <TypeToDelete
        board={confirm}
        locale={locale}
        onClose={() => setConfirm(null)}
        onConfirm={async (b) => {
          await deleteBoardForever(b, loggedIn);
          setConfirm(null);
          void load();
        }}
      />
    </div>
  );
}

function SubjectLessons({
  slug,
  name,
  lessons,
  boards,
  am,
  locale,
  onBack,
  onNew,
  lessonName,
}: {
  slug: string;
  name: string;
  lessons: NotesLesson[];
  boards: Board[];
  am: boolean;
  locale: Locale;
  onBack: () => void;
  onNew: (l: NotesLesson) => void;
  lessonName: (l: NotesLesson) => string;
}) {
  const first = lessons[0];
  // grade → unit → lessons
  const groups = new Map<string, NotesLesson[]>();
  for (const l of lessons) {
    const k = `${l.grade}|${am ? l.unit_am : l.unit_en}`;
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  return (
    <section className="mt-6" style={subjectStyle(slug, first?.subject.color)}>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {t(locale, "myNotes")}
      </button>
      <h2 className="mt-2 text-xl font-semibold text-accent-ink">{name}</h2>
      {!lessons.length && <p className="mt-3 text-muted">{t(locale, "comingSoon")}</p>}
      {[...groups.entries()].map(([k, ls]) => {
        const [grade, unit] = k.split("|");
        return (
          <div key={k} className="mt-5">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              {am ? `${grade}ኛ ክፍል` : `Grade ${grade}`} · {unit}
            </p>
            <ul className="space-y-2">
              {ls.map((l) => {
                const bs = boards.filter((b) => b.lesson_id === l.id);
                return (
                  <li key={l.id} className="rounded-2xl bg-surface p-3 ring-1 ring-line">
                    <div className="flex items-center gap-2">
                      <Link href={l.href} className="min-w-0 flex-1 truncate font-medium text-ink hover:underline">
                        {lessonName(l)}
                      </Link>
                      <button type="button" onClick={() => onNew(l)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent-soft px-3 text-sm font-medium text-accent-ink">
                        <Plus className="size-4" aria-hidden /> {t(locale, "newBoard")}
                      </button>
                    </div>
                    {bs.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {bs.map((b) => (
                          <li key={b.id}>
                            <Link href={`/notes/board?id=${b.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-sm text-ink ring-1 ring-line hover:ring-accent/50">
                              <BoardIcon icon={b.emoji} colour={b.colour} size={20} className="!rounded-md" />
                              {b.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/** A tiny picture of the board: each card as a soft rectangle. */
function BoardThumb({ nodes, colour }: { nodes: BoardNode[]; colour: string }) {
  if (!nodes.length) return <div className="h-28" style={{ background: `${colour}14` }} aria-hidden />;
  const minX = Math.min(...nodes.map((n) => n.x)),
    minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w)),
    maxY = Math.max(...nodes.map((n) => n.y + n.h));
  const w = Math.max(1, maxX - minX),
    h = Math.max(1, maxY - minY);
  return (
    <svg viewBox={`${minX - 20} ${minY - 20} ${w + 40} ${h + 40}`} className="h-28 w-full" style={{ background: `${colour}12` }} aria-hidden preserveAspectRatio="xMidYMid meet">
      {nodes
        .slice(0, 80)
        .sort((a, b) => (a.type === "frame" ? -1 : 0) - (b.type === "frame" ? -1 : 0))
        .map((n) => (
          <rect
            key={n.id}
            x={n.x}
            y={n.y}
            width={n.w}
            height={n.h}
            rx={14}
            fill={n.type === "frame" ? "none" : COLOR_BG[n.data.color ?? (n.type === "sticky" ? "yellow" : "white")]}
            stroke={n.type === "frame" ? colour : "#d9d3c5"}
            strokeWidth={n.type === "frame" ? 3 : 2}
            strokeDasharray={n.type === "frame" ? "10 8" : undefined}
          />
        ))}
    </svg>
  );
}

/** "Delete forever" is permanent: type the board name to confirm. */
function TypeToDelete({ board, locale, onClose, onConfirm }: { board: Board | null; locale: Locale; onClose: () => void; onConfirm: (b: Board) => Promise<void> }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <AnimatePresence>
      {board && (
        <motion.div key="del" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] grid place-items-center bg-ink/30 p-4" onClick={onClose}>
          <div role="dialog" aria-label={t(locale, "deleteForever")} className="w-full max-w-sm rounded-3xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-semibold text-ink">{t(locale, "deleteForever")}?</p>
            <p className="mt-1 text-sm text-muted">This can&apos;t be undone. Its cards, arrows, flashcards and images are deleted.</p>
            <label className="mt-4 block text-sm text-muted">
              Type <span className="rounded bg-ink/[0.06] px-1.5 font-mono text-ink">{board.title}</span> to confirm
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl bg-paper px-3 ring-1 ring-line" aria-label="Board name" />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onClose} className="h-11 flex-1 rounded-full bg-ink/[0.05] font-medium">
                {t(locale, "cancel")}
              </button>
              <button
                type="button"
                disabled={typed.trim() !== board.title || busy}
                onClick={async () => {
                  setBusy(true);
                  await onConfirm(board);
                  setBusy(false);
                  setTyped("");
                }}
                className="h-11 flex-1 rounded-full bg-bad font-medium text-white disabled:opacity-40"
              >
                {t(locale, "deleteForever")}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NotesHomeSkeleton() {
  return (
    <div aria-busy="true">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton mt-3 h-4 w-72" />
      <div className="skeleton mt-6 h-12 w-full rounded-2xl" />
      <div className="mt-8 flex gap-3 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-44 w-56 shrink-0 rounded-2xl" />
        ))}
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
