"use client";

import type { ReactNode } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardList, Lightbulb, ListOrdered, RefreshCw, Target, XCircle, type LucideIcon } from "lucide-react";
import type { Bi, Guide, Lang } from "@/lib/types";
import { BiText } from "@/components/study/text";

/**
 * The teacher-style solution template, the same everywhere (worked examples, homework, extra practice, quiz, Rem):
 *   What the question asks · What we know · Rule we use   → <GuideIntro> (above the steps)
 *   Steps (teal number badges)                              → the numbered working (WorkedExample / quiz)
 *   Answer (green) · why not the other choices · Common mistake (amber) · Quick check → <GuideOutro>
 * The data is plain text (no emojis); the icons and colours come from here. Translucent tints, so it also reads
 * well on a dark background.
 */
export type SectionKind = "asks" | "known" | "rule" | "steps" | "answer" | "wrong" | "mistake" | "check" | "tip";

export const SECTION: Record<SectionKind, { icon: LucideIcon; color: string; label: Bi }> = {
  asks: { icon: Target, color: "#2563eb", label: { en: "What the question asks", am: "ጥያቄው ምን ይጠይቃል" } },
  known: { icon: ClipboardList, color: "#475569", label: { en: "What we know", am: "የምናውቀው" } },
  rule: { icon: BookOpen, color: "#7c3aed", label: { en: "Rule we use", am: "የምንጠቀመው ሕግ" } },
  steps: { icon: ListOrdered, color: "#0f766e", label: { en: "Steps", am: "ደረጃዎች" } },
  answer: { icon: CheckCircle2, color: "#16a34a", label: { en: "Answer", am: "መልስ" } },
  wrong: { icon: XCircle, color: "#64748b", label: { en: "Why not the other choices?", am: "ሌሎቹ ምርጫዎች ለምን አይሆኑም?" } },
  mistake: { icon: AlertTriangle, color: "#d97706", label: { en: "Common mistake", am: "የተለመደ ስሕተት" } },
  check: { icon: RefreshCw, color: "#0f766e", label: { en: "Quick check", am: "ፈጣን ማረጋገጫ" } },
  tip: { icon: Lightbulb, color: "#ca8a04", label: { en: "Tip", am: "ምክር" } },
};

export const guideLabel = (k: SectionKind, lang: Lang) => (lang === "am" ? SECTION[k].label.am : SECTION[k].label.en);

/** The 28 px soft circle with the section's 16 px icon. */
export function SectionIcon({ kind, className = "" }: { kind: SectionKind; className?: string }) {
  const { icon: Icon, color } = SECTION[kind];
  return (
    <span className={`grid size-7 shrink-0 place-items-center rounded-full ${className}`} style={{ backgroundColor: `${color}1f`, color }} aria-hidden>
      <Icon className="size-4" strokeWidth={2.25} />
    </span>
  );
}

/** A section heading: icon circle + small coloured label. */
export function SectionHead({ kind, lang, children }: { kind: SectionKind; lang: Lang; children?: ReactNode }) {
  return (
    <p className="flex items-center gap-2">
      <SectionIcon kind={kind} />
      <span className="text-[12px] font-semibold tracking-wide uppercase" style={{ color: SECTION[kind].color }}>
        {children ?? guideLabel(kind, lang)}
      </span>
    </p>
  );
}

/** A tinted box for one section (answer = green, mistake = amber …). */
export function SectionBox({ kind, lang, children, className = "" }: { kind: SectionKind; lang: Lang; children: ReactNode; className?: string }) {
  const { color } = SECTION[kind];
  return (
    <div className={`rounded-xl px-3 py-2.5 ${className}`} style={{ backgroundColor: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}33` }}>
      <SectionHead kind={kind} lang={lang} />
      <div className="mt-1 pl-9 text-[15px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

function Row({ kind, value, lang }: { kind: SectionKind; value: Bi; lang: Lang }) {
  return (
    <div>
      <SectionHead kind={kind} lang={lang} />
      <div className="mt-0.5 pl-9 text-[15px] leading-relaxed text-ink">
        <BiText value={value} lang={lang} />
      </div>
    </div>
  );
}

/** What the question asks · What we know · Rule we use: shown before the steps. */
export function GuideIntro({ guide, lang, className = "" }: { guide?: Guide | null; lang: Lang; className?: string }) {
  if (!guide || (!guide.asks && !guide.known && !guide.rule)) return null;
  return (
    <div className={`space-y-3 ${className}`}>
      {guide.asks && <Row kind="asks" value={guide.asks} lang={lang} />}
      {guide.known && <Row kind="known" value={guide.known} lang={lang} />}
      {guide.rule && (
        <SectionBox kind="rule" lang={lang}>
          <BiText value={guide.rule} lang={lang} />
        </SectionBox>
      )}
    </div>
  );
}

/** Why not the other choices · Common mistake · Quick check: shown after the answer. */
export function GuideOutro({ guide, lang, className = "" }: { guide?: Guide | null; lang: Lang; className?: string }) {
  if (!guide || (!guide.wrong?.length && !guide.mistake && !guide.check)) return null;
  return (
    <div className={`space-y-2.5 ${className}`}>
      {!!guide.wrong?.length && (
        <div className="rounded-xl bg-surface/80 px-3 py-2.5 ring-1 ring-line">
          <SectionHead kind="wrong" lang={lang} />
          <ul className="mt-1 space-y-1 pl-9 text-[14.5px] leading-relaxed text-ink/90">
            {guide.wrong.map((w, i) => (
              <li key={i}>
                <BiText value={w} lang={lang} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {guide.mistake && (
        <SectionBox kind="mistake" lang={lang}>
          <BiText value={guide.mistake} lang={lang} />
        </SectionBox>
      )}
      {guide.check && (
        <SectionBox kind="check" lang={lang}>
          <BiText value={guide.check} lang={lang} />
        </SectionBox>
      )}
    </div>
  );
}

/** The teal step number badge (1, 2, 3 …). */
export function StepBadge({ n }: { n: number }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full font-sans text-[12px] font-semibold text-white" style={{ backgroundColor: SECTION.steps.color }} aria-hidden>
      {n}
    </span>
  );
}

/** Emoji at the start of a line (from Rem, or older content) → the section it stands for. */
export const EMOJI_SECTION: Record<string, SectionKind> = {
  "📌": "asks",
  "📋": "known",
  "🔧": "rule",
  "👣": "steps",
  "✅": "answer",
  "⚠️": "mistake",
  "⚠": "mistake",
  "💡": "tip",
};
