"use client";

import { createContext, forwardRef, useContext, useEffect, useId, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

/* Small building blocks for the admin area: same light, flat style as the site. */

export const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className = "", children, disabled, ...rest },
  ref,
) {
  const v = {
    primary: "bg-accent text-white hover:brightness-110",
    secondary: "bg-surface text-ink ring-1 ring-line hover:bg-paper",
    ghost: "text-muted hover:bg-ink/[0.05] hover:text-ink",
    danger: "bg-bad text-white hover:brightness-110",
  }[variant];
  const s = size === "sm" ? "h-8 gap-1.5 px-3 text-[13px]" : "h-10 gap-2 px-4 text-sm";
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium transition-[filter,background-color,color,opacity] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${v} ${s} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function Card({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, action, sub }: { children: React.ReactNode; action?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{children}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const BADGE = {
  neutral: "bg-ink/[0.05] text-muted",
  accent: "bg-accent-soft text-accent-ink",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  warn: "bg-tip-soft text-tip",
  note: "bg-note-soft text-note",
} as const;

export function Badge({ tone = "neutral", children, className = "" }: { tone?: keyof typeof BADGE; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${BADGE[tone]} ${className}`}>{children}</span>;
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  description?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${checked ? "bg-accent" : "bg-line-strong"}`}
      >
        <motion.span layout transition={spring} className={`size-6 rounded-full bg-white shadow-sm ${checked ? "ml-auto" : ""}`} />
      </button>
    </div>
  );
}

const fieldBox =
  "w-full rounded-xl bg-paper px-3 text-[14px] text-ink ring-1 ring-line transition-[box-shadow,background-color] placeholder:text-faint focus:bg-surface focus:ring-2 focus:ring-accent/40";

export function Field({ label, hint, children, className = "" }: { label?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-[13px] font-medium text-ink/80">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...rest }, ref) {
  return <input ref={ref} className={`${fieldBox} h-10 ${className}`} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className = "", rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={`${fieldBox} resize-y py-2 leading-relaxed ${className}`} {...rest} />;
});

export function Select({ className = "", children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${fieldBox} h-10 cursor-pointer pr-8 ${className}`} {...rest}>
      {children}
    </select>
  );
}

/** English | Amharic side by side (stacked on phones). */
export function BiField({
  label,
  en,
  am,
  onChange,
  multiline,
  rows,
}: {
  label: string;
  en: string;
  am: string;
  onChange: (v: { en: string; am: string }) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const C = multiline ? Textarea : Input;
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-ink/80">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <span className="pointer-events-none absolute top-2 right-2 text-[10px] font-semibold text-faint">EN</span>
          <C value={en} rows={rows} onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange({ en: e.target.value, am })} className="pr-8" />
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute top-2 right-2 text-[10px] font-semibold text-faint">አማ</span>
          <C value={am} rows={rows} onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange({ en, am: e.target.value })} className="am pr-8" />
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, text, icon, action }: { title: string; text?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">{icon ?? <Inbox className="size-6" aria-hidden />}</span>
      <p className="mt-4 font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", text }: { title?: string; text?: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        {text && <p className="mt-0.5 text-bad/80">{text}</p>}
      </div>
    </div>
  );
}

export function Sk({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-xl bg-ink/[0.06] ${className}`} aria-hidden />;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "10 Nov 2026" (+ "14:05") in Addis Ababa time. Pure arithmetic (UTC+3), so the server and every browser
 * produce exactly the same text (no hydration mismatches from different Intl data).
 */
export function fmtDate(v: string | null | undefined, withTime = false) {
  if (!v) return "—";
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return "—";
  const d = new Date(t + 3 * 3600e3);
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return withTime ? `${date}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` : date;
}

/** "5 min ago" relative to `now` (pure: pass the time in). */
export function timeAgo(v: string | null | undefined, now: number) {
  if (!v) return "never";
  const s = (now - new Date(v).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(v);
}

/* The current time for "x min ago" labels: only known after the page mounts in the browser (never during
   prerendering), then refreshed every 30 s. One clock for the whole admin area. */
const NowCtx = createContext<{ now: number | null; startedAt: number | null }>({ now: null, startedAt: null });

export function NowProvider({ children }: { children: React.ReactNode }) {
  const [clock, setClock] = useState<{ now: number | null; startedAt: number | null }>({ now: null, startedAt: null });
  useEffect(() => {
    // Reading the clock is only allowed after mount (never during prerendering).
    const t = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClock({ now: t, startedAt: t });
    const id = setInterval(() => setClock((c) => ({ ...c, now: Date.now() })), 30_000);
    return () => clearInterval(id);
  }, []);
  return <NowCtx value={clock}>{children}</NowCtx>;
}

export const useNowMs = () => useContext(NowCtx).now;
/** When this page was opened (the moment its data was loaded), for "Updated just now". */
export const useStartedAt = () => useContext(NowCtx).startedAt;

/** "5 min ago", rendered only in the browser (an absolute date until then). */
export function TimeAgo({ value }: { value: string | null | undefined }) {
  const now = useNowMs();
  return <>{now === null ? (value ? fmtDate(value) : "never") : timeAgo(value, now)}</>;
}

export function usd(n: number | null | undefined, digits = 2) {
  const v = Number(n ?? 0);
  return `$${v < 0.01 && v > 0 ? v.toFixed(4) : v.toFixed(digits)}`;
}
