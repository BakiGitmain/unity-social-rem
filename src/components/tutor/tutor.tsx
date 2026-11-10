"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Bubble, type BubbleHandle, type Side } from "@/components/tutor/bubble";
import { SelectionPill } from "@/components/tutor/selection-pill";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";
import type { TutorIntent, TutorView } from "@/lib/tutor/config";

/** The chat (AI SDK, markdown, Supabase history) is only downloaded when the bubble is first used. */
const loadPanel = () => import("@/components/tutor/chat-panel");
const ChatPanel = dynamic(loadPanel, { ssr: false });

export type TutorAsk = { id: number; text: string; intent?: TutorIntent; selectionContext?: string };

/**
 * AI study tutor "Rem" on lesson pages: the floating bubble, the "Explain further" selection pill,
 * and the lazily loaded chat panel. `hidden` hides everything (quiz focus mode, finished screen).
 */
export function Tutor({
  lessonId,
  lessonTitle,
  locale,
  view,
  part,
  hidden,
}: {
  lessonId: string;
  lessonTitle: string;
  locale: Locale;
  view: TutorView;
  part: number;
  hidden: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [side, setSide] = useState<Side>("right");
  const [ask, setAsk] = useState<TutorAsk | null>(null);
  const bubble = useRef<BubbleHandle>(null);

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
    <>
      <Bubble
        ref={bubble}
        hidden={hidden || open}
        locale={locale}
        onOpen={() => openChat()}
        onSide={setSide}
        onWarmUp={() => void loadPanel()}
      />
      {!hidden && (
        <SelectionPill
          locale={locale}
          onAsk={(quote, paragraph, amharic) =>
            openChat({
              text: `> ${quote}\n\n${t(locale, amharic ? "explainPromptAm" : "explainPrompt")}`,
              selectionContext: paragraph,
            })
          }
        />
      )}
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
    </>
  );
}
