"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Languages, NotebookPen, Sparkles } from "lucide-react";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";
import { TUTOR } from "@/lib/tutor/config";

type Picked = { text: string; paragraph: string; x: number; y: number; below: boolean };

/** Text blocks that count as "the surrounding paragraph". */
const PARA = "p, li, td, th, blockquote, h2, h3, [data-block]";

/**
 * When the student selects 3–300 characters inside the notes ([data-tutor-notes]), a small pill appears
 * right above the selection (below it on touch screens, so it doesn't fight the phone's own menu).
 * It never prevents normal selecting or copying.
 */
export function SelectionPill({
  locale,
  onAsk,
  onNote,
  canAsk = true,
}: {
  locale: Locale;
  onAsk: (quote: string, paragraph: string, amharic: boolean) => void;
  /** "📝 Add to notes": quote the selection on a notes board. */
  onNote?: (quote: string, paragraph: string) => void;
  /** Rem's buttons (off when the AI tutor is switched off). */
  canAsk?: boolean;
}) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const read = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return setPicked(null);
      const text = sel.toString().replace(/\s+/g, " ").trim();
      if (text.length < TUTOR.selectionMin || text.length > TUTOR.selectionMax) return setPicked(null);
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      if (!el?.closest("[data-tutor-notes]")) return setPicked(null);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return setPicked(null);
      const para = (el.closest(PARA) ?? el).textContent?.replace(/\s+/g, " ").trim() ?? "";
      const half = 120;
      setPicked({
        text,
        paragraph: para.slice(0, 700),
        x: Math.min(window.innerWidth - half - 8, Math.max(half + 8, rect.left + rect.width / 2)),
        y: coarse ? Math.min(window.innerHeight - 64, rect.bottom + 34) : rect.top - 10, // below the selection handles on phones
        below: coarse,
      });
    };
    const schedule = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(read, 180);
    };
    const hide = () => setPicked(null);
    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
    };
  }, []);

  const ask = (amharic: boolean) => {
    if (!picked) return;
    onAsk(picked.text, picked.paragraph, amharic);
    window.getSelection()?.removeAllRanges();
    setPicked(null);
  };

  const note = () => {
    if (!picked) return;
    onNote?.(picked.text, picked.paragraph);
    window.getSelection()?.removeAllRanges();
    setPicked(null);
  };
  const am = locale === "am" ? "am" : "";

  return (
    <AnimatePresence>
      {picked && (
        <motion.div
          key="pill"
          role="toolbar"
          aria-label={t(locale, "explainFurther")}
          initial={{ opacity: 0, scale: 0.9, y: picked.below ? -4 : 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
          transition={{ type: "spring", stiffness: 520, damping: 32 }}
          style={{ left: picked.x, top: picked.y, translateX: "-50%", translateY: picked.below ? "0%" : "-100%" }}
          className="fixed z-50 flex items-center gap-0.5 rounded-full bg-ink p-1 text-[13px] font-medium text-white shadow-[0_10px_28px_-10px_rgba(29,42,44,0.55)]"
          // Keep the selection while clicking the pill (desktop).
          onPointerDown={(e) => e.preventDefault()}
        >
{canAsk && (
            <>
          <button
            type="button"
            onClick={() => ask(false)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/15 focus-visible:bg-white/15 focus-visible:outline-none ${am}`}
          >
            <Sparkles className="size-3.5 text-accent-soft" aria-hidden />
            {t(locale, "explainFurther")}
          </button>
          <span className="h-4 w-px bg-white/20" aria-hidden />
          <button
            type="button"
            onClick={() => ask(true)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/15 focus-visible:bg-white/15 focus-visible:outline-none ${am}`}
          >
            <Languages className="size-3.5 text-accent-soft" aria-hidden />
            {t(locale, "inAmharic")}
          </button>
            </>
          )}
          {onNote && (
            <>
              {canAsk && <span className="h-4 w-px bg-white/20" aria-hidden />}
              <button
                type="button"
                onClick={note}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/15 focus-visible:bg-white/15 focus-visible:outline-none ${am}`}
              >
                <NotebookPen className="size-3.5 text-accent-soft" aria-hidden />
                {t(locale, "addToNotes")}
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
