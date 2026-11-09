import type { CSSProperties } from "react";

/** Soft colour theme per subject. No purple, all light and flat. */
export const SUBJECT_THEMES: Record<string, { accent: string; soft: string; ink: string; tint: string }> = {
  mathematics: { accent: "#2563c9", soft: "#e8f0fc", ink: "#1d4c99", tint: "#f4f8fe" },
  english: { accent: "#c0620e", soft: "#fdf0e1", ink: "#8f4708", tint: "#fffaf3" },
  geography: { accent: "#0f766e", soft: "#e3f3ef", ink: "#0b5a53", tint: "#f3faf8" },
  history: { accent: "#b4472e", soft: "#fbebe5", ink: "#8a3421", tint: "#fef8f5" },
};

const FALLBACK = SUBJECT_THEMES.geography;

/** CSS variables that re-colour everything inside a subject. */
export function subjectStyle(slug: string): CSSProperties {
  const t = SUBJECT_THEMES[slug] ?? FALLBACK;
  return {
    "--accent": t.accent,
    "--accent-soft": t.soft,
    "--accent-ink": t.ink,
    "--accent-tint": t.tint,
  } as CSSProperties;
}
