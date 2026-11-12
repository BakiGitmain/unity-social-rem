"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button, Input } from "@/components/admin/ui";

/** Accessible modal: Esc closes, focus moves inside, scroll is locked. Bottom sheet on phones. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the open/close effect on every render (that stole focus while typing).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = setTimeout(() => box.current?.querySelector<HTMLElement>("input, textarea, select, button[data-autofocus]")?.focus(), 60);
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.div
            ref={box}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={`relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-[0_24px_60px_-20px_rgba(29,42,44,0.45)] sm:rounded-3xl ${
              wide ? "sm:max-w-3xl" : "sm:max-w-lg"
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold text-ink">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/[0.05] hover:text-ink">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Dangerous actions: the admin must TYPE the exact name (username, lesson title...) to enable the button.
 * The server checks it again where it matters (delete user).
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmText,
  actionLabel,
  onConfirm,
  children,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  /** What must be typed (ONLY for permanent deletes). Leave it out for a one-click "Are you sure?". */
  confirmText?: string;
  actionLabel: string;
  onConfirm: () => Promise<void> | void;
  children?: React.ReactNode;
  danger?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = !confirmText || typed.trim() === confirmText;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (busy) return;
        setTyped("");
        onClose();
      }}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={!ok}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setTyped("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {actionLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${danger ? "bg-bad-soft text-bad" : "bg-tip-soft text-tip"}`}>
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 text-sm text-ink/80">{message}</div>
      </div>
      {children && <div className="mt-4">{children}</div>}
      {confirmText && (
      <label className="mt-5 block">
        <span className="mb-1.5 block text-[13px] text-muted">
          Type <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[12.5px] text-ink">{confirmText}</span> to confirm
        </span>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ok && !busy) (e.currentTarget.closest("[role=dialog]")?.querySelector("button.bg-bad, button.bg-accent") as HTMLButtonElement | null)?.click();
          }}
        />
      </label>
      )}
    </Modal>
  );
}
