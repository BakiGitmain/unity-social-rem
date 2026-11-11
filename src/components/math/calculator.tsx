"use client";

import { useState } from "react";
import { motion, useDragControls } from "framer-motion";
import { Delete, GripHorizontal, X } from "lucide-react";
import { evaluate, formatNumber, toFraction } from "@/lib/math/calc";

const KEYS = [
  ["C", "(", ")", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ".", "^", "√"],
  ["⌫", "a/b", "²", "="],
];

/** Small draggable calculator: + − × ÷, powers, √, brackets, and the answer as a fraction. */
export function Calculator({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<{ value: number } | { error: string } | null>(null);
  const [asFraction, setAsFraction] = useState(false);
  const controls = useDragControls();

  const run = () => {
    if (!expr.trim()) return;
    try {
      setResult({ value: evaluate(expr) });
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Error" });
    }
  };

  const press = (k: string) => {
    if (k === "C") {
      setExpr("");
      setResult(null);
    } else if (k === "⌫") setExpr((x) => [...x].slice(0, -1).join(""));
    else if (k === "=") run();
    else if (k === "a/b") setAsFraction((f) => !f);
    else if (k === "√") setExpr((x) => x + "√(");
    else {
      // Start a new sum after "=" unless the key continues it with an operator.
      if (result && "value" in result && !/[+−×÷^²)]/.test(k)) {
        setExpr(k);
        setResult(null);
        return;
      }
      if (result && "value" in result) setExpr(formatNumber(result.value) + k);
      else setExpr((x) => x + k);
      setResult(null);
    }
  };

  const shown = result && "value" in result ? (asFraction && toFraction(result.value)) || formatNumber(result.value) : null;

  return (
    <motion.div
      role="dialog"
      aria-label="Calculator"
      drag
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragElastic={0.08}
      initial={{ opacity: 0, scale: 0.92, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 16 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-4 z-[75] w-[260px] rounded-3xl bg-surface p-3 shadow-[0_18px_44px_-18px_rgba(29,42,44,0.45)] ring-1 ring-line md:bottom-24 md:left-6"
    >
      <div className="flex items-center">
        <div
          onPointerDown={(e) => controls.start(e)}
          className="flex flex-1 cursor-grab touch-none items-center gap-1.5 py-1 text-xs font-medium text-muted active:cursor-grabbing"
        >
          <GripHorizontal className="size-4" aria-hidden /> Calculator
        </div>
        <button type="button" onClick={onClose} aria-label="Close calculator" className="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/[0.06]">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-1 rounded-2xl bg-paper px-3 py-2 text-right">
        <input
          value={expr}
          onChange={(e) => {
            setExpr(e.target.value);
            setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          aria-label="Calculation"
          placeholder="0"
          inputMode="none"
          className="w-full bg-transparent text-right text-lg text-ink tabular-nums placeholder:text-faint"
        />
        <p className={`min-h-6 text-sm tabular-nums ${result && "error" in result ? "text-bad" : "font-semibold text-accent-ink"}`} aria-live="polite">
          {result ? ("error" in result ? result.error : `= ${shown}`) : ""}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {KEYS.flat().map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === "⌫" ? "Delete" : k === "a/b" ? "Show as fraction" : k}
            aria-pressed={k === "a/b" ? asFraction : undefined}
            className={`grid h-10 place-items-center rounded-xl text-[15px] font-medium transition-transform active:scale-95 ${
              k === "="
                ? "bg-accent text-white"
                : /[÷×−+^√²()]/.test(k)
                  ? "bg-accent-soft text-accent-ink"
                  : k === "a/b" && asFraction
                    ? "bg-accent text-white"
                    : k === "C"
                      ? "bg-bad-soft text-bad"
                      : "bg-ink/[0.04] text-ink"
            }`}
          >
            {k === "⌫" ? <Delete className="size-4" aria-hidden /> : k}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
