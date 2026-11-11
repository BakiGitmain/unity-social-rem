"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { InkEditor, useInkDoc } from "@/components/ink/ink-editor";

/**
 * Calculation paper for working things out (same tools as the Answer Paper, bigger). Saved per question on
 * the device. NEVER sent to the AI and never graded.
 * Desktop: side panel. Phone: full-screen sheet.
 */
export function ScratchPaper({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const api = useInkDoc(`scratch:${id}`);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("ink-sheet-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("ink-sheet-open");
    };
  }, [onClose]);

  return (
    <motion.aside
      role="dialog"
      aria-label="Calculation paper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[85] md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[min(560px,48vw)]"
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        className="absolute inset-0 flex flex-col overflow-hidden bg-surface pt-[env(safe-area-inset-top)] md:rounded-l-3xl md:border-l md:border-line md:shadow-[-12px_0_40px_-20px_rgba(29,42,44,0.35)]"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <p className="mr-auto pl-1 text-sm font-semibold text-ink">Calculation paper</p>
          <button type="button" onClick={onClose} aria-label="Close calculation paper" className="grid size-11 place-items-center rounded-full text-muted hover:bg-ink/[0.06]">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <InkEditor api={api} className="min-h-0 flex-1" ariaLabel="Calculation paper" />
      </motion.div>
    </motion.aside>
  );
}
