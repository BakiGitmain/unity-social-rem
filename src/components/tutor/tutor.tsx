"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAnyDialogOpen } from "@/components/use-any-dialog";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { NotebookPen } from "lucide-react";
import { useUser } from "@/components/user-provider";
import { LessonBoardsSheet, type LessonRef } from "@/components/notes/lesson-boards";
import { SaveNoteContext } from "@/components/notes/save-context";
import { CARD_SIZE, uid, type BoardNode, type Board } from "@/lib/notes/types";
import { Bubble, type BubbleHandle, type Side } from "@/components/tutor/bubble";
import { SelectionPill } from "@/components/tutor/selection-pill";
import { useSiteSettings } from "@/components/site-settings";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";
import type { TutorIntent, TutorView } from "@/lib/tutor/config";

/** The chat (AI SDK, markdown, Supabase history) is only downloaded when the bubble is first used. */
const loadPanel = () => import("@/components/tutor/chat-panel");
const ChatPanel = dynamic(loadPanel, { ssr: false });
/** Before the first question: load the chat code and wake the (possibly cold) tutor server function, once per page. */
let warmed = false;
const warmUp = () => {
  void loadPanel();
  if (warmed) return;
  warmed = true;
  void fetch("/api/tutor", { method: "GET", cache: "no-store" }).catch(() => {});
};

export type TutorAsk = { id: number; text: string; intent?: TutorIntent; selectionContext?: string };

/**
 * AI study tutor "Rem" on lesson pages: the floating bubble, the "Explain further" selection pill,
 * and the lazily loaded chat panel. `hidden` hides everything (quiz focus mode, finished screen).
 */
type NotesPayload = Omit<BoardNode, "x" | "y" | "z" | "updated_at">;

export function Tutor({
  lessonId,
  lessonTitle,
  locale,
  view,
  part,
  hidden: hiddenProp,
  notes,
}: {
  lessonId: string;
  lessonTitle: string;
  locale: Locale;
  view: TutorView;
  part: number;
  hidden: boolean;
  /** Notes: the 📝 button above Rem, "Add to notes" in the selection pill, "Save to notes" in the chat. */
  notes?: { lesson: LessonRef; href: string; label: string };
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [side, setSide] = useState<Side>("right");
  const [ask, setAsk] = useState<TutorAsk | null>(null);
  const bubble = useRef<BubbleHandle>(null);
  // Admin kill switch (AI tutor → off): no bubble at all.
  const aiOn = useSiteSettings().settings.features.ai_tutor;
  const hidden = hiddenProp || !aiOn;
  const { username } = useUser();
  // Rem + the notes button step aside while any sheet / modal is open (profile sheet, "Which board?", writing sheet…)
  const dialogOpen = useAnyDialogOpen();
  const [sheet, setSheet] = useState<null | { mode: "open" } | { mode: "pick"; payload: NotesPayload }>(null);
  const [added, setAdded] = useState<{ board: Board; card: string } | null>(null);

  const addToNotes = useCallback(
    (payload: NotesPayload) => setSheet({ mode: "pick", payload }),
    [],
  );
  const quote = (text: string) =>
    notes &&
    addToNotes({
      id: uid(),
      type: "quote",
      ...CARD_SIZE.quote,
      data: { quote: { text: text.slice(0, 1500), lessonId, href: `${notes.href}?part=${part + 1}`, part: part + 1, lessonLabel: notes.label } },
    });
  const saveAnswer = useCallback(
    (text: string, question: string) =>
      notes &&
      addToNotes({
        id: uid(),
        type: "note",
        w: 300,
        h: 220,
        data: { title: questionTitle(question), body: text.replace(/\n?FOLLOWUPS:[\s\S]*$/, "").slice(0, 6000), color: "blue" },
      }),
    [notes, addToNotes],
  );

  // Quiz focus mode / finished screen: close the chat too.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hidden) setOpen(false);
  }, [hidden]);

  const openChat = useCallback((a?: Omit<TutorAsk, "id">) => {
    setLoaded(true);
    setOpen(true);
    if (a) setAsk({ ...a, id: Date.now() });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => bubble.current?.focus());
  }, []);

  return (
    <SaveNoteContext value={notes ? saveAnswer : null}>
      <Bubble
        ref={bubble}
        hidden={(notes ? hiddenProp : hidden) || open || dialogOpen}
        remHidden={!aiOn}
        locale={locale}
        onOpen={() => openChat()}
        onSide={setSide}
        onWarmUp={warmUp}
        extra={
          notes && (
            <motion.button
              type="button"
              aria-label={t(locale, "boardsForLesson")}
              title={t(locale, "notes")}
              onClick={() => setSheet({ mode: "open" })}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              className="grid size-11 place-items-center rounded-full bg-surface text-accent shadow-[0_8px_20px_-10px_rgba(29,42,44,0.5)] ring-1 ring-line"
            >
              <NotebookPen className="size-5" aria-hidden />
            </motion.button>
          )
        }
      />
      {!hiddenProp && (aiOn || notes) && (
        <SelectionPill
          locale={locale}
          canAsk={aiOn}
          onNote={notes ? (q) => quote(q) : undefined}
          onAsk={(quote, paragraph, amharic) =>
            openChat({
              text: `> ${quote}\n\n${t(locale, amharic ? "explainPromptAm" : "explainPrompt")}`,
              selectionContext: paragraph,
            })
          }
        />
      )}
      {notes && (
        <LessonBoardsSheet
          lesson={notes.lesson}
          locale={locale}
          open={!!sheet}
          mode={sheet?.mode ?? "open"}
          title={sheet?.mode === "pick" ? t(locale, "chooseBoard") : undefined}
          onClose={() => setSheet(null)}
          onPick={async (b) => {
            if (sheet?.mode !== "pick") return;
            const { appendCard } = await import("@/lib/notes/client");
            try {
              await appendCard(b.id, sheet.payload, !!username);
              setAdded({ board: b, card: sheet.payload.id });
              setTimeout(() => setAdded(null), 4000);
            } catch {}
          }}
        />
      )}
      <AnimatePresence>
        {added && (
          <motion.p
            key="added"
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`fixed bottom-28 left-1/2 z-[72] flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg md:bottom-8 ${locale === "am" ? "am" : ""}`}
          >
            {t(locale, "addedToNotes", { b: added.board.title })}
            <Link href={`/notes/board?id=${added.board.id}&card=${added.card}`} className="font-semibold text-accent-soft underline">
              {t(locale, "openBoard")}
            </Link>
          </motion.p>
        )}
      </AnimatePresence>
      {loaded && (
        <ChatPanel
          open={open && !hidden}
          onClose={close}
          side={side}
          ask={ask}
          lessonId={lessonId}
          lessonTitle={lessonTitle}
          locale={locale}
          view={view}
          part={part}
        />
      )}
    </SaveNoteContext>
  );
}

/** A card title from the student's question ("> quote …Explain" from "Explain further" → the quote). */
function questionTitle(question: string): string {
  const q = question.trim();
  const quoted = q.startsWith(">") ? q.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, "")).join(" ") : "";
  const t = (quoted ? `“${quoted.trim()}”` : q).replace(/\s+/g, " ").trim();
  if (!t) return "Rem AI";
  return t.length > 120 ? `${t.slice(0, 117).trimEnd()}…` : t;
}
