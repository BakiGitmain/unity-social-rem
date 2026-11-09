import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Friendly empty state for subjects/grades without content yet. */
export function ComingSoon({
  title = "Coming soon",
  message,
  backHref,
  backLabel,
}: {
  title?: string;
  message: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center sm:py-16">
      <svg viewBox="0 0 160 110" className="h-28 w-auto" aria-hidden="true">
        <ellipse cx="80" cy="98" rx="58" ry="7" fill="var(--accent-soft)" />
        <rect x="38" y="30" width="84" height="62" rx="10" fill="#fff" stroke="var(--line-strong)" strokeWidth="2" />
        <path d="M38 44h84" stroke="var(--line-strong)" strokeWidth="2" />
        <circle cx="49" cy="37" r="2.5" fill="var(--accent)" opacity=".5" />
        <circle cx="57" cy="37" r="2.5" fill="var(--accent)" opacity=".35" />
        <rect x="50" y="54" width="44" height="6" rx="3" fill="var(--accent-soft)" />
        <rect x="50" y="66" width="60" height="6" rx="3" fill="var(--accent-soft)" />
        <rect x="50" y="78" width="32" height="6" rx="3" fill="var(--accent-soft)" />
        <g transform="translate(112 18)">
          <circle r="16" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
          <path d="M0-8v8l5 4" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
        <path d="M22 26l4 4M26 26l-4 4M136 70l3 3M139 70l-3 3" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity=".5" />
      </svg>
      <h2 className="mt-6 text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-muted">{message}</p>
      <p className="am mt-1 text-sm text-faint">በቅርቡ ይመጣል</p>
      {backHref && (
        <Link
          href={backHref}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
      )}
    </div>
  );
}
