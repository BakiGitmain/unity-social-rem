"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Delete, Keyboard, X } from "lucide-react";

/* ------------------------------------------------------------------ registry for drag & drop */

/** Every math input registers an "insert" function, so a symbol dropped on it lands at its cursor. */
const inserters = new WeakMap<Element, (text: string) => void>();

const SYMBOLS = ["∪", "∩", "∈", "∉", "⊆", "⊂", "∅", "{", "}", ",", "′", "\\", "Δ", "|", "ℕ", "ℤ", "ℚ", "ℝ", "−", "²", "³", "√"];
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "/", "x", "A", "B", "C"];

const spring = { type: "spring", stiffness: 520, damping: 40 } as const;

function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

export type MathInputHandle = { focus: () => void };

/**
 * Text input with a math keyboard. Tap a symbol to insert it at the cursor, or drag it into the box.
 * On phones the keyboard slides up from the bottom like a real keyboard (with digits, so the phone's
 * own keyboard can stay closed).
 */
export const MathInput = forwardRef<
  MathInputHandle,
  {
    value: string;
    onChange: (v: string) => void;
    onEnter?: () => void;
    placeholder?: string;
    ariaLabel: string;
    disabled?: boolean;
    state?: "idle" | "good" | "bad";
    shakeKey?: number;
  }
>(function MathInput({ value, onChange, onEnter, placeholder, ariaLabel, disabled, state = "idle", shakeKey = 0 }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const caret = useRef<[number, number]>([value.length, value.length]);
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  });
  const [open, setOpen] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const phone = useIsPhone();

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  const remember = () => {
    const el = inputRef.current;
    if (el) caret.current = [el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length];
  };

  const insert = useCallback(
    (text: string) => {
      const v = valueRef.current;
      const [s, e] = caret.current;
      const start = Math.min(s, v.length);
      const end = Math.min(Math.max(e, start), v.length);
      const next = v.slice(0, start) + text + v.slice(end);
      const pos = start + text.length;
      caret.current = [pos, pos];
      onChange(next);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        if (!phone) el.focus({ preventScroll: true });
        el.setSelectionRange(pos, pos);
      });
    },
    [onChange, phone],
  );

  const backspace = () => {
    const v = valueRef.current;
    const [s, e] = caret.current;
    if (s !== e) {
      caret.current = [s, s];
      onChange(v.slice(0, s) + v.slice(e));
    } else if (s > 0) {
      const chars = [...v.slice(0, s)];
      chars.pop();
      const head = chars.join("");
      caret.current = [head.length, head.length];
      onChange(head + v.slice(s));
    }
  };

  // Gentle shake on a wrong answer.
  useEffect(() => {
    const el = wrapRef.current;
    if (!shakeKey || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }, [shakeKey]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    inserters.set(el, insert);
    const hover = (e: Event) => setDropHover((e as CustomEvent<boolean>).detail);
    el.addEventListener("usr-drop-hover", hover);
    return () => {
      inserters.delete(el);
      el.removeEventListener("usr-drop-hover", hover);
    };
  }, [insert]);

  const ring =
    state === "good" ? "ring-2 ring-good bg-good-soft" : state === "bad" ? "ring-2 ring-bad/70 bg-bad-soft/60" : dropHover ? "ring-2 ring-accent bg-[var(--accent-tint)]" : "ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-accent/60";

  return (
    <div>
      <div
        ref={wrapRef}
        data-math-input
        className={`flex items-center gap-1 rounded-2xl bg-surface pr-1.5 transition-[box-shadow,background-color] ${ring}`}
      >
        <input
          ref={inputRef}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          // When our keyboard is open on a phone, keep the phone's keyboard closed.
          inputMode={phone && open ? "none" : "text"}
          onChange={(e) => {
            onChange(e.target.value);
            caret.current = [e.target.selectionStart ?? 0, e.target.selectionEnd ?? 0];
          }}
          onSelect={remember}
          onKeyUp={remember}
          onClick={remember}
          onFocus={() => phone && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter?.();
            }
          }}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 font-medium text-[17px] tracking-wide text-ink placeholder:font-normal placeholder:text-faint disabled:opacity-80"
        />
        {!disabled && (
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Hide math keyboard" : "Show math keyboard"}
            aria-expanded={open}
            className={`grid size-9 shrink-0 place-items-center rounded-xl transition-colors ${open ? "bg-accent text-white" : "text-muted hover:bg-ink/[0.05]"}`}
          >
            <Keyboard className="size-[18px]" aria-hidden />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && !disabled && (
          <MathKeyboard
            phone={phone}
            onInsert={insert}
            onBackspace={backspace}
            onClose={() => setOpen(false)}
            onEnter={() => {
              onEnter?.();
              if (phone) setOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

/* ------------------------------------------------------------------ keyboard */

function MathKeyboard({
  phone,
  onInsert,
  onBackspace,
  onClose,
  onEnter,
}: {
  phone: boolean;
  onInsert: (s: string) => void;
  onBackspace: () => void;
  onClose: () => void;
  onEnter: () => void;
}) {
  // Esc closes the keyboard (first: it must not also close a sheet or dialog behind it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const keys = (
    <>
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-11">
        {SYMBOLS.map((s) => (
          <SymbolKey key={s} symbol={s} onInsert={onInsert} />
        ))}
      </div>
      {phone && (
        <div className="mt-1.5 grid grid-cols-8 gap-1.5">
          {DIGITS.map((s) => (
            <SymbolKey key={s} symbol={s} onInsert={onInsert} plain />
          ))}
        </div>
      )}
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onInsert(" ")}
          className="h-11 flex-1 rounded-xl bg-surface text-sm text-muted ring-1 ring-line active:scale-95"
        >
          space
        </button>
        <button
          type="button"
          aria-label="Delete"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onBackspace}
          className="grid h-11 w-14 place-items-center rounded-xl bg-surface text-muted ring-1 ring-line active:scale-95"
        >
          <Delete className="size-5" aria-hidden />
        </button>
        {phone && (
          <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={onEnter} className="h-11 rounded-xl bg-accent px-5 text-sm font-medium text-white active:scale-95">
            Check
          </button>
        )}
      </div>
      <p className="mt-2 hidden text-center text-xs text-faint sm:block">Tap a symbol, or drag it into the answer box.</p>
    </>
  );

  if (phone)
    return (
      <motion.div
        role="toolbar"
        aria-label="Math keyboard"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={spring}
        className="fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl bg-[#f1eee6] px-2.5 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_-12px_rgba(29,42,44,0.3)]"
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted">Math keyboard</span>
          <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={onClose} aria-label="Close math keyboard" className="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/[0.06]">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {keys}
      </motion.div>
    );

  return (
    <motion.div
      role="toolbar"
      aria-label="Math keyboard"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={spring}
      className="overflow-hidden"
    >
      <div className="mt-2 rounded-2xl bg-[#f1eee6] p-2">{keys}</div>
    </motion.div>
  );
}

/** A key: tap inserts at the cursor; dragging it (mouse, finger or pen) drops it into any math input. */
function SymbolKey({ symbol, onInsert, plain }: { symbol: string; onInsert: (s: string) => void; plain?: boolean }) {
  const drag = useRef<{ x: number; y: number; ghost: HTMLDivElement | null; over: Element | null } | null>(null);

  const setOver = (el: Element | null) => {
    const d = drag.current;
    if (!d || d.over === el) return;
    d.over?.dispatchEvent(new CustomEvent("usr-drop-hover", { detail: false }));
    el?.dispatchEvent(new CustomEvent("usr-drop-hover", { detail: true }));
    d.over = el;
  };

  const end = (e: React.PointerEvent, cancel = false) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.ghost) {
      if (!cancel) onInsert(symbol); // a tap
      return;
    }
    d.ghost.remove();
    const target = cancel ? null : document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-math-input]");
    d.over?.dispatchEvent(new CustomEvent("usr-drop-hover", { detail: false }));
    if (target) inserters.get(target)?.(symbol);
  };

  return (
    <button
      type="button"
      aria-label={`Insert ${symbol}`}
      onPointerDown={(e) => {
        e.preventDefault(); // keep focus (and the cursor) in the answer box
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, ghost: null, over: null };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.ghost && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
          const g = document.createElement("div");
          g.textContent = symbol;
          g.setAttribute("aria-hidden", "true");
          g.style.cssText =
            "position:fixed;left:0;top:0;z-index:100;pointer-events:none;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:var(--accent);color:#fff;font-size:20px;font-weight:600;box-shadow:0 10px 24px -8px rgba(0,0,0,.35);transition:transform 40ms linear";
          document.body.appendChild(g);
          d.ghost = g;
        }
        if (d.ghost) {
          d.ghost.style.transform = `translate(${e.clientX - 22}px, ${e.clientY - 40}px) scale(1.08)`;
          setOver(document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-math-input]") ?? null);
        }
      }}
      onPointerUp={(e) => end(e)}
      onPointerCancel={(e) => end(e, true)}
      className={`h-11 touch-none rounded-xl text-[19px] select-none active:scale-95 ${plain ? "bg-surface/70 text-ink/80" : "bg-surface font-medium text-ink"} ring-1 ring-line transition-transform hover:ring-accent/50`}
    >
      {symbol}
    </button>
  );
}
