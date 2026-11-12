"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronRight, Loader2, Plus, X } from "lucide-react";
import { useUser } from "@/components/user-provider";
import { createBoard, listBoards } from "@/lib/notes/client";
import { TEMPLATES, type TemplateId } from "@/lib/notes/templates";
import type { Board } from "@/lib/notes/types";
import { BOARD_COLOURS, BOARD_ICONS, BOARD_ICON_KEYS, BoardIcon, TemplateIcon } from "@/components/notes/board-icon";
import type { Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";

export type LessonRef = { id: string; subjectId?: string | null; code: string; title: string };

export { BOARD_COLOURS };
const spring = { type: "spring", stiffness: 480, damping: 38 } as const;

/**
 * "Boards for this lesson": open one, or make a new one (name, icon, colour, template). The lesson is attached
 * automatically. mode "pick" = choose the board to add something to (Add to notes / Save to notes).
 */
export function LessonBoardsSheet({
  lesson,
  locale,
  open,
  onClose,
  mode = "open",
  onPick,
  title,
}: {
  lesson: LessonRef;
  locale: Locale;
  open: boolean;
  onClose: () => void;
  mode?: "open" | "pick";
  onPick?: (b: Board) => void;
  title?: string;
}) {
  const router = useRouter();
  const { username, loading } = useUser();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [form, setForm] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(BOARD_ICON_KEYS[0]!);
  const [colour, setColour] = useState("teal");
  const [template, setTemplate] = useState<TemplateId>("blank");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const am = locale === "am";
  const tr = (k: Parameters<typeof t>[1], v?: Record<string, string | number>) => t(locale, k, v);

  useEffect(() => {
    if (!open || loading) return;
    let stop = false;
    void listBoards(!!username).then((bs) => !stop && setBoards(bs.filter((b) => b.lesson_id === lesson.id)));
    return () => {
      stop = true;
    };
  }, [open, loading, username, lesson.id]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  const choose = (b: Board) => {
    if (mode === "pick") onPick?.(b);
    else router.push(`/notes/board?id=${b.id}`);
    onClose();
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await createBoard(
        { lessonId: lesson.id, subjectId: lesson.subjectId, title: name || `${lesson.code} ${lesson.title}`.slice(0, 120), emoji, colour, template, topic: lesson.title },
        !!username,
      );
      choose(s.board);
      setForm(false);
      setName("");
    } catch (e) {
      setError(e instanceof Error && e.message === "limit" ? "You have reached the board limit." : "Could not create the board.");
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="fixed inset-0 z-[70] bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title ?? tr("boardsForLesson")}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={spring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_: unknown, i: PanInfo) => (i.offset.y > 90 || i.velocity.y > 500) && onClose()}
            className={`fixed inset-x-0 bottom-0 z-[71] mx-auto max-h-[88dvh] max-w-lg overflow-y-auto rounded-t-3xl bg-surface px-4 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-16px_rgba(29,42,44,0.35)] sm:bottom-6 sm:rounded-3xl ${am ? "am" : ""}`}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden />
            <div className="mb-3 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-ink">{title ?? tr("boardsForLesson")}</p>
                <p className="truncate text-sm text-muted">
                  {lesson.code} · {lesson.title}
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label={tr("close")} className="grid size-10 place-items-center rounded-full text-muted hover:bg-ink/[0.06]">
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {!form && (
              <>
                {boards === null ? (
                  <p className="flex items-center gap-2 py-4 text-sm text-muted">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {boards.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => choose(b)}
                          className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-paper px-3 py-2 text-left ring-1 ring-line hover:ring-line-strong"
                        >
                          <BoardIcon icon={b.emoji} colour={b.colour} />
                          <span className="min-w-0 flex-1 truncate font-medium text-ink">{b.title}</span>
                          {b.local && <span className="text-[11px] text-faint">{tr("onThisDevice")}</span>}
                          <ChevronRight className="size-4 text-faint" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setForm(true)}
                  className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent font-medium text-white"
                >
                  <Plus className="size-5" aria-hidden /> {tr("newBoard")}
                </button>
                {!username && !loading && <p className="mt-2 text-center text-xs text-muted">{tr("loginToKeepNotes")}</p>}
              </>
            )}

            {form && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void create();
                }}
                className="space-y-4"
              >
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">{tr("boardName")}</span>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`${lesson.code} ${lesson.title}`}
                    maxLength={120}
                    className="h-12 w-full rounded-2xl bg-paper px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent/50"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Icon">
                  {BOARD_ICON_KEYS.map((k) => {
                    const Icon = BOARD_ICONS[k]!;
                    const c = BOARD_COLOURS[colour] ?? BOARD_COLOURS.teal!;
                    const on = emoji === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={k}
                        onClick={() => setEmoji(k)}
                        className="grid size-11 place-items-center rounded-xl transition-[background,box-shadow,color] duration-200"
                        style={{
                          color: on ? "#fff" : c,
                          background: on ? `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 75%, black))` : `color-mix(in srgb, ${c} 9%, white)`,
                          boxShadow: on ? `0 6px 14px -8px ${c}` : `inset 0 0 0 1px color-mix(in srgb, ${c} 18%, transparent)`,
                        }}
                      >
                        <Icon className="size-5" strokeWidth={2.1} aria-hidden />
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2" role="radiogroup" aria-label="Colour">
                  {Object.entries(BOARD_COLOURS).map(([k, c]) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={colour === k}
                      aria-label={k}
                      onClick={() => setColour(k)}
                      className={`size-9 rounded-full ${colour === k ? "ring-2 ring-ink/50 ring-offset-2" : ""}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">{tr("template")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TEMPLATES.map((tp) => (
                      <button
                        key={tp.id}
                        type="button"
                        aria-pressed={template === tp.id}
                        onClick={() => setTemplate(tp.id)}
                        className={`min-h-14 rounded-2xl px-3 py-2 text-left ring-1 ${template === tp.id ? "bg-accent-soft ring-2 ring-accent" : "bg-paper ring-line"}`}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-ink">
                          <TemplateIcon id={tp.id} colour={BOARD_COLOURS[colour] ?? BOARD_COLOURS.teal} />
                          {am ? tp.am : tp.en}
                        </span>
                        <span className="block text-[11px] text-muted">{tp.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {error && <p className="text-sm text-bad">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm(false)} className="h-12 flex-1 rounded-full bg-ink/[0.05] font-medium text-ink">
                    {tr("cancel")}
                  </button>
                  <button type="submit" disabled={busy} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent font-medium text-white disabled:opacity-70">
                    {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    {tr("create")}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
