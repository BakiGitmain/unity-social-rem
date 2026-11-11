"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { Lang, VennBlock as VennBlockData } from "@/lib/types";
import { evalVenn, elementsOf } from "@/lib/math/venn";
import { BiText } from "@/components/study/text";
import { VennDiagram, regionName } from "@/components/math/venn-diagram";

const STEP_MS = 2400;

/**
 * Venn diagram in the notes: tap a region to see its elements; "Show me" animates the steps
 * (e.g. shade B∪C, then remove it from A), with a caption for each step.
 */
export function VennBlock({ block, lang }: { block: VennBlockData; lang: Lang }) {
  const steps = block.steps ?? [];
  const [step, setStep] = useState(-1); // -1 = the block's own shading
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const labels = block.venn.labels ?? ["A", "B", "C"].slice(0, block.venn.sets);

  const shaded = useMemo(() => {
    const expr = step >= 0 ? steps[step]?.shade : block.shade;
    if (!expr) return [];
    try {
      return evalVenn(expr, block.venn.sets, labels);
    } catch {
      return [];
    }
  }, [step, steps, block.shade, block.venn.sets, labels]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setTimeout(() => {
      if (step >= steps.length - 1) setPlaying(false);
      else setStep((s) => s + 1);
    }, step === -1 ? 50 : STEP_MS);
    return () => clearTimeout(timer.current);
  }, [playing, step, steps.length]);

  const play = () => {
    setPicked(null);
    if (step >= steps.length - 1) setStep(-1);
    setPlaying(true);
  };

  const pickedEls = picked ? elementsOf([picked], block.venn.elements) : [];

  return (
    <figure className="my-6 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
      <div className="flex justify-center">
        <VennDiagram
          venn={block.venn}
          shaded={shaded}
          mode="inspect"
          focus={picked}
          showElements={block.showElements ?? !!block.venn.elements}
          onRegion={(r) => setPicked((p) => (p === r ? null : r))}
        />
      </div>

      {/* tapped region */}
      <AnimatePresence>
        {picked && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto mt-2 w-fit rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-ink"
          >
            {regionName(picked, labels, block.venn.sets)}
            {block.venn.elements ? `: ${pickedEls.length ? `{${pickedEls.join(", ")}}` : "∅ (empty)"}` : ""}
          </motion.p>
        )}
      </AnimatePresence>

      {/* step caption */}
      <AnimatePresence mode="wait">
        {step >= 0 && steps[step] && (
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="mt-3 text-center text-[15px] text-ink/90"
          >
            <span className="mr-1.5 font-semibold text-accent-ink">
              {step + 1}/{steps.length}
            </span>
            <BiText value={steps[step]!.text} lang={lang} single />
          </motion.p>
        )}
      </AnimatePresence>

      {steps.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => (playing ? setPlaying(false) : play())}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {playing ? "Pause" : step >= 0 ? "Play again" : "Show me"}
          </button>
          <div className="flex items-center gap-1" role="group" aria-label="Steps">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Step ${i + 1}`}
                aria-current={i === step ? "step" : undefined}
                onClick={() => {
                  setPlaying(false);
                  setStep(i);
                }}
                className={`size-2.5 rounded-full transition-colors ${i === step ? "bg-accent" : i < step ? "bg-accent/40" : "bg-line-strong"}`}
              />
            ))}
          </div>
          {step >= 0 && (
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setStep(-1);
              }}
              aria-label="Reset"
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/[0.05]"
            >
              <RotateCcw className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
      {block.caption && (
        <figcaption className="mt-3 text-center text-sm text-muted">
          <BiText value={block.caption} lang={lang} single />
        </figcaption>
      )}
    </figure>
  );
}
