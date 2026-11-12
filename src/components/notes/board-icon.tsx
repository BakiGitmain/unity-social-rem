"use client";

import {
  BookOpen,
  BrainCircuit,
  Calculator,
  Columns3,
  Globe2,
  Landmark,
  Lightbulb,
  MoveRight,
  NotebookPen,
  Network,
  Scale,
  Sparkles,
  Square,
  Star,
  History,
  Waypoints,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";

/** Board pictures: coloured icons (never emojis). The key is stored in boards.emoji. */
export const BOARD_ICONS: Record<string, LucideIcon> = {
  notebook: NotebookPen,
  brain: BrainCircuit,
  star: Star,
  globe: Globe2,
  math: Calculator,
  book: BookOpen,
  history: Landmark,
  idea: Lightbulb,
  sparkles: Sparkles,
};
export const BOARD_ICON_KEYS = Object.keys(BOARD_ICONS);

/** Template icons. */
export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  blank: Square,
  mindmap: Network,
  cornell: Columns3,
  cause: MoveRight,
  compare: Scale,
  timeline: History,
  venn: CircleDashed,
  concept: Waypoints,
};

export const BOARD_COLOURS: Record<string, string> = {
  teal: "#0f766e",
  blue: "#2563c9",
  orange: "#c0620e",
  red: "#b4472e",
  green: "#15803d",
  slate: "#5c6a6d",
};

/** A soft tile in the board colour with the icon in that colour (subtle gradient). Unknown keys → notebook. */
export function BoardIcon({ icon, colour, size = 36, className = "" }: { icon?: string | null; colour?: string | null; size?: number; className?: string }) {
  const Icon = BOARD_ICONS[icon ?? ""] ?? NotebookPen;
  const c = BOARD_COLOURS[colour ?? ""] ?? colour ?? BOARD_COLOURS.teal!;
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-xl ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, color-mix(in srgb, ${c} 18%, white), color-mix(in srgb, ${c} 8%, white))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 22%, transparent)`,
        color: c,
      }}
    >
      <Icon style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.1} />
    </span>
  );
}

/** Template icon in a small coloured tile. */
export function TemplateIcon({ id, colour = "#0f766e" }: { id: string; colour?: string }) {
  const Icon = TEMPLATE_ICONS[id] ?? Square;
  return (
    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${colour} 12%, white)`, color: colour }}>
      <Icon className="size-4" strokeWidth={2.2} />
    </span>
  );
}
