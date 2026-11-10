"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CircleUserRound } from "lucide-react";
import { useUser } from "@/components/user-provider";
import { AccountPanel } from "@/components/nav/account-panel";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";

const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;

/** Desktop profile button + dropdown that scales in from the top-right corner. */
export function AccountMenu({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { username } = useUser();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t(locale, "profile")}
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.94 }}
        transition={spring}
        className={`flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 transition-colors ${
          open ? "bg-ink/[0.06]" : "hover:bg-ink/[0.04]"
        }`}
      >
        {username ? (
          <span
            className="grid size-7 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink ring-1 ring-accent/20"
            aria-hidden
          >
            {username[0]!.toUpperCase()}
          </span>
        ) : (
          <CircleUserRound className="size-7 text-ink" strokeWidth={1.6} aria-hidden />
        )}
        {username && <span className="max-w-28 truncate text-sm font-medium text-ink">@{username}</span>}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} className="grid">
          <ChevronDown className="size-4 text-muted" aria-hidden />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.12 } }}
            transition={spring}
            style={{ transformOrigin: "top right" }}
            className="absolute top-full right-0 z-50 mt-2 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgba(29,42,44,0.25)]"
          >
            <AccountPanel locale={locale} onDone={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
