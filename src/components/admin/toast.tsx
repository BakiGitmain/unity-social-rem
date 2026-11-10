"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; title: string; text?: string; tone: Tone };

const Ctx = createContext<(t: Omit<Toast, "id" | "tone"> & { tone?: Tone }) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const remove = (id: number) => setItems((x) => x.filter((t) => t.id !== id));
  const push = useCallback((t: Omit<Toast, "id" | "tone"> & { tone?: Tone }) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { tone: "success", ...t, id }]);
    setTimeout(() => remove(id), t.tone === "error" ? 7000 : 3800);
  }, []);

  return (
    <Ctx value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = t.tone === "error" ? AlertTriangle : t.tone === "info" ? Info : CheckCircle2;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 480, damping: 34 }}
                role={t.tone === "error" ? "alert" : "status"}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-[0_14px_36px_-14px_rgba(29,42,44,0.6)]"
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${t.tone === "error" ? "text-[#ffb59a]" : t.tone === "info" ? "text-white/80" : "text-[#8de0b0]"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.title}</p>
                  {t.text && <p className="mt-0.5 text-white/70">{t.text}</p>}
                </div>
                <button type="button" onClick={() => remove(t.id)} aria-label="Dismiss" className="-m-1 grid size-7 place-items-center rounded-full hover:bg-white/10">
                  <X className="size-3.5" aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx>
  );
}

export const useToast = () => useContext(Ctx);
