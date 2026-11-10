import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/** % change vs the previous period (null when there is nothing to compare). */
export function pctChange(now: number | null | undefined, prev: number | null | undefined): number | null {
  const a = Number(now ?? 0);
  const b = Number(prev ?? 0);
  if (!b) return a ? 100 : null;
  return ((a - b) / b) * 100;
}

export function Kpi({
  label,
  value,
  change,
  hint,
  icon,
  tone,
  children,
}: {
  label: string;
  value: React.ReactNode;
  change?: number | null;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "warn" | "bad";
  children?: React.ReactNode;
}) {
  const up = (change ?? 0) > 0.5;
  const down = (change ?? 0) < -0.5;
  return (
    <div className={`rounded-3xl bg-surface p-4 ring-1 sm:p-5 ${tone === "bad" ? "ring-bad/40" : tone === "warn" ? "ring-tip/40" : "ring-line"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && <span className="text-accent">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        {change !== undefined && change !== null && (
          <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-good" : down ? "text-bad" : "text-faint"}`}>
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : down ? <ArrowDownRight className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
            {Math.abs(change).toFixed(0)}%
          </span>
        )}
        {hint && <span className="text-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
