"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { GlossaryEntry, Lang } from "@/lib/types";

type Ctx = { entries: GlossaryEntry[]; lang: Lang };
const GlossaryContext = createContext<Ctx>({ entries: [], lang: "en" });

export function GlossaryProvider({ entries, lang, children }: Ctx & { children: React.ReactNode }) {
  // Longest terms first so "Spatial science" wins over "Spatial".
  const sorted = [...entries].sort((a, b) => b.term.en.length - a.term.en.length);
  return <GlossaryContext value={{ entries: sorted, lang }}>{children}</GlossaryContext>;
}

/** Finds the glossary entry a highlighted phrase refers to (if any). */
export function useGlossaryEntry(text: string): GlossaryEntry | null {
  const { entries } = useContext(GlossaryContext);
  const lower = text.toLowerCase();
  for (const e of entries) {
    const en = e.term.en.toLowerCase();
    if (text.length > e.term.en.length + 28) continue; // a whole sentence is not a term
    if (lower.includes(en) || (e.term.am && text.includes(e.term.am))) return e;
  }
  return null;
}

/** A key term you can tap (or hover) to see a short definition. */
export function Term({ entry, children }: { entry: GlossaryEntry; children: React.ReactNode }) {
  const { lang } = useContext(GlossaryContext);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(288, window.innerWidth - 32);
    const left = Math.min(Math.max(16, r.left + r.width / 2 - width / 2), window.innerWidth - 16 - width);
    const below = r.top < 150;
    setPos({ left, top: below ? r.bottom + 8 : r.top - 8, below, width });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const termText = lang === "am" ? entry.term.am : entry.term.en;

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          hoverTimer.current = setTimeout(show, 180);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return;
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          setOpen(false);
        }}
        className="key-term term-trigger"
      >
        {children}
      </button>
      {/* pos is only set after a tap/hover, so server and first client render match (no portal). */}
      {pos &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                id={id}
                role="tooltip"
                initial={{ opacity: 0, scale: 0.94, y: pos.below ? -4 : 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
                transition={{ type: "spring", stiffness: 520, damping: 32 }}
                style={{
                  position: "fixed",
                  left: pos.left,
                  top: pos.top,
                  translateY: pos.below ? 0 : "-100%",
                  transformOrigin: pos.below ? "top center" : "bottom center",
                  width: pos.width,
                }}
                className="pointer-events-none z-[60] rounded-2xl bg-ink px-4 py-3 text-left text-white shadow-[0_12px_32px_-12px_rgba(29,42,44,0.45)]"
              >
                <p className={`text-sm font-semibold text-[#9fe0d4] ${lang === "am" ? "am" : ""}`}>{termText}</p>
                <p className={`mt-1 text-sm leading-relaxed text-white/90 ${lang === "am" ? "am" : ""}`}>
                  {lang === "am" ? entry.definition.am : entry.definition.en}
                </p>
                {lang === "both" && <p className="am mt-1 text-sm leading-relaxed text-white/65">{entry.definition.am}</p>}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
