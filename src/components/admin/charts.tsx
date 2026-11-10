"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SUBJECT_THEMES } from "@/lib/subjects";

const GRID = "#ece8df";
const AXIS = { fontSize: 11, fill: "#8b9698" };

const shortDay = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  return t.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

function Tip({ active, payload, label, format }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-xs shadow-[0_10px_28px_-12px_rgba(29,42,44,0.35)] ring-1 ring-line">
      <p className="mb-1 font-semibold text-ink">{label && /^\d{4}-\d{2}-\d{2}$/.test(label) ? shortDay(label) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-muted">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-ink tabular-nums">{format ? format(Number(p.value ?? 0)) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Time series (one or two series) as a soft area chart. */
export function TrendChart({
  data,
  series,
  height = 220,
  format,
}: {
  data: Record<string, string | number>[];
  series: { key: string; name: string; color?: string }[];
  height?: number;
  format?: (v: number) => string;
}) {
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`g-${s.key}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? "var(--accent)"} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color ?? "var(--accent)"} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} allowDecimals={!!format} tickFormatter={format} />
          <Tooltip content={<Tip format={format} />} cursor={{ stroke: GRID }} />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color ?? "var(--accent)"}
              strokeWidth={2}
              fill={`url(#g-${s.key}-${i})`}
              animationDuration={700}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bars per day, or per category (subjects get their colour). */
export function BarsChart({
  data,
  x,
  y,
  name,
  height = 220,
  subjectColors,
  format,
}: {
  data: Record<string, string | number>[];
  x: string;
  y: string;
  name: string;
  height?: number;
  subjectColors?: boolean;
  format?: (v: number) => string;
}) {
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => (/^\d{4}-/.test(String(v)) ? shortDay(String(v)) : String(v))} minTickGap={12} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} allowDecimals={!!format} tickFormatter={format} />
          <Tooltip content={<Tip format={format} />} cursor={{ fill: "rgba(29,42,44,0.04)" }} />
          <Bar dataKey={y} name={name} radius={[6, 6, 0, 0]} fill="var(--accent)" animationDuration={700} maxBarSize={42}>
            {subjectColors && data.map((d, i) => <Cell key={i} fill={SUBJECT_THEMES[String(d[x])]?.accent ?? "var(--accent)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 7d / 30d / 90d, kept in the URL (?range=30) so the server loads the right data. */
export function RangeTabs({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div role="tablist" aria-label="Date range" className="inline-flex rounded-full bg-ink/[0.05] p-1">
      {[7, 30, 90].map((d) => (
        <button
          key={d}
          type="button"
          role="tab"
          aria-selected={value === d}
          onClick={() => {
            const p = new URLSearchParams(params.toString());
            p.set("range", String(d));
            router.push(`${pathname}?${p.toString()}`, { scroll: false });
          }}
          className={`relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${value === d ? "text-ink" : "text-muted hover:text-ink"}`}
        >
          {value === d && <motion.span layoutId="range-pill" className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(29,42,44,0.14)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative">{d}d</span>
        </button>
      ))}
    </div>
  );
}
