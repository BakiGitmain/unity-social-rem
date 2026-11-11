"use client";

import { useId, useRef } from "react";
import { motion } from "framer-motion";
import type { VennData } from "@/lib/types";
import { REGIONS } from "@/lib/math/venn";

/* Geometry (SVG units). Region anchors are where the elements of that region are written. */
const GEO = {
  2: {
    w: 320,
    h: 210,
    circles: [
      { cx: 122, cy: 108, r: 70 },
      { cx: 198, cy: 108, r: 70 },
    ],
    labels: [
      { x: 70, y: 40 },
      { x: 250, y: 40 },
    ],
    anchors: { A: [92, 110], AB: [160, 110], B: [228, 110], none: [36, 188] } as Record<string, [number, number]>,
  },
  3: {
    w: 320,
    h: 290,
    circles: [
      { cx: 125, cy: 112, r: 68 },
      { cx: 195, cy: 112, r: 68 },
      { cx: 160, cy: 174, r: 68 },
    ],
    labels: [
      { x: 64, y: 54 },
      { x: 256, y: 54 },
      { x: 160, y: 274 },
    ],
    anchors: { A: [98, 96], B: [222, 96], C: [160, 212], AB: [160, 82], AC: [124, 156], BC: [196, 156], ABC: [160, 134], none: [34, 270] } as Record<
      string,
      [number, number]
    >,
  },
} as const;

const NAMES = ["A", "B", "C"];

/** Friendly name of a region, e.g. "only A", "A and B", "outside all sets". */
export function regionName(r: string, labels: string[], size: 2 | 3): string {
  if (r === "none") return size === 2 ? `outside ${labels[0]} and ${labels[1]}` : "outside all three sets";
  const inSets = r.split("").map((c) => labels[NAMES.indexOf(c)] ?? c);
  if (inSets.length === 1) return `only ${inSets[0]}`;
  if (inSets.length === size) return size === 2 ? `${inSets[0]} and ${inSets[1]} (both)` : "all three sets";
  return `${inSets.join(" and ")} only`;
}

/**
 * Venn diagram (2 or 3 sets) drawn from data. `shaded` = regions to fill (animated).
 * mode "inspect": tapping a region calls onRegion (show its elements). "answer": tapping toggles it.
 */
export function VennDiagram({
  venn,
  shaded,
  mode = "view",
  onRegion,
  focus,
  showElements = true,
  tone = "accent",
  ariaLabel,
}: {
  venn: VennData;
  shaded: string[];
  mode?: "view" | "inspect" | "answer";
  onRegion?: (region: string) => void;
  focus?: string | null;
  showElements?: boolean;
  tone?: "accent" | "good" | "bad";
  ariaLabel?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const g = GEO[venn.sets];
  const labels = venn.labels ?? NAMES.slice(0, venn.sets);
  const regions = REGIONS[venn.sets];
  const fill = tone === "good" ? "var(--good)" : tone === "bad" ? "var(--bad)" : "var(--accent)";

  /** Which region is at this point? (pure geometry, so masks don't matter for tapping) */
  const regionAt = (x: number, y: number) => {
    const key = g.circles
      .map((c, i) => ((x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.r ** 2 ? NAMES[i] : ""))
      .join("");
    return key || "none";
  };

  const onPointer = (e: React.PointerEvent<SVGRectElement>) => {
    if (mode === "view" || !onRegion) return;
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    if (pt.x < 6 || pt.y < 6 || pt.x > g.w - 6 || pt.y > g.h - 6) return;
    onRegion(regionAt(pt.x, pt.y));
  };

  /** One region: the U rectangle, clipped to every circle it is inside, masked out of the others. */
  const regionShape = (r: string) => {
    const inside = r === "none" ? [] : r.split("").map((c) => NAMES.indexOf(c));
    let el: React.ReactNode = (
      <rect x={6} y={6} width={g.w - 12} height={g.h - 12} fill={fill} mask={`url(#${uid}-m-${r})`} />
    );
    for (const i of inside) el = <g clipPath={`url(#${uid}-c${i})`}>{el}</g>;
    return el;
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${g.w} ${g.h}`}
      className="h-auto w-full max-w-[420px] touch-manipulation select-none"
      role="img"
      aria-label={ariaLabel ?? `Venn diagram of ${labels.join(", ")}`}
    >
      <defs>
        {g.circles.map((c, i) => (
          <clipPath key={i} id={`${uid}-c${i}`}>
            <circle cx={c.cx} cy={c.cy} r={c.r} />
          </clipPath>
        ))}
        {regions.map((r) => {
          const outside = g.circles.map((_, i) => i).filter((i) => r === "none" || !r.includes(NAMES[i]!));
          return (
            <mask key={r} id={`${uid}-m-${r}`} maskUnits="userSpaceOnUse" x={0} y={0} width={g.w} height={g.h}>
              <rect x={0} y={0} width={g.w} height={g.h} fill="white" />
              {outside.map((i) => (
                <circle key={i} cx={g.circles[i]!.cx} cy={g.circles[i]!.cy} r={g.circles[i]!.r} fill="black" />
              ))}
            </mask>
          );
        })}
      </defs>

      {/* universal set */}
      <rect x={6} y={6} width={g.w - 12} height={g.h - 12} rx={16} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={1.5} />
      <text x={20} y={28} fontSize={14} fontWeight={600} fill="var(--muted)" fontStyle="italic">
        U
      </text>

      {/* shading (each region fades in/out smoothly) */}
      {regions.map((r) => (
        <motion.g
          key={r}
          initial={false}
          animate={{ opacity: shaded.includes(r) ? 0.5 : focus === r ? 0.18 : 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 24 }}
        >
          {regionShape(r)}
        </motion.g>
      ))}

      {/* outlines */}
      {g.circles.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill="none" stroke="var(--ink)" strokeOpacity={0.55} strokeWidth={1.6} />
      ))}
      {g.labels.map((l, i) => (
        <text key={i} x={l.x} y={l.y} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--accent-ink)">
          {labels[i]}
        </text>
      ))}

      {/* elements written in their regions */}
      {showElements &&
        regions.map((r) => {
          const els = venn.elements?.[r];
          if (!els?.length) return null;
          const [x, y] = g.anchors[r]!;
          const lines: string[] = [];
          for (let i = 0; i < els.length; i += 3) lines.push(els.slice(i, i + 3).join(", "));
          return (
            <text key={r} x={x} y={y - (lines.length - 1) * 8} textAnchor={r === "none" ? "start" : "middle"} fontSize={13.5} fill="var(--ink)">
              {lines.map((ln, i) => (
                <tspan key={i} x={x} dy={i === 0 ? 0 : 16}>
                  {ln}
                </tspan>
              ))}
            </text>
          );
        })}

      {/* tap layer */}
      {mode !== "view" && (
        <rect x={6} y={6} width={g.w - 12} height={g.h - 12} fill="transparent" className="cursor-pointer" onPointerUp={onPointer} />
      )}
    </svg>
  );
}
