"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ArrowRight, CalendarPlus, Check, Clock, Coffee, MapPin, X } from "lucide-react";
import { useNow } from "@/lib/use-now";
import { useTimeFormat } from "@/lib/use-time-format";
import { addisParts, formatMinutes, type TimeFormat } from "@/lib/time/clock";
import { entriesForDay, weeklyStats, type ClassEntry } from "@/lib/time/schedule";
import { subjectStyle } from "@/lib/subjects";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";
import { SubjectIcon } from "@/components/subject-icon";
import { Skeleton } from "@/components/skeleton";
import { FillBar, LiveDot, Rolling, TimeFormatSwitch } from "@/components/schedule/bits";
import {
  DAY_END,
  DAY_START,
  PERIODS,
  dayName,
  duration,
  ethiopianDate,
  floorText,
  gregorianDate,
  periodsText,
  roomName,
  subjectName,
} from "@/components/schedule/format";

const PX = 1.5; // timeline pixels per minute
const spring = { type: "spring", stiffness: 420, damping: 36 } as const;

export function ScheduleView({ entries, locale, sectionName }: { entries: ClassEntry[]; locale: Locale; sectionName: string }) {
  const now = useNow();
  const [format, setFormat] = useTimeFormat();
  const [view, setView] = useState<"day" | "week">("day");
  const [day, setDay] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  const [details, setDetails] = useState<ClassEntry | null>(null);
  const am = locale === "am" ? "am" : "";

  const p = now === null ? null : addisParts(now);
  const today = p?.weekday ?? null;
  const nowMin = p ? p.secondOfDay / 60 : 0;

  // Default to today once the clock is known.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (day === null && today !== null) setDay(today);
  }, [day, today]);

  const pick = (d: number) => {
    if (day !== null) setDir(d > day ? 1 : -1);
    setDay(d);
  };

  if (!p || day === null) return <ScheduleSkeleton />;

  return (
    <div className={am}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t(locale, "scheduleTitle")}</h1>
          <p className="mt-1 text-muted">{sectionName}</p>
          <p className="mt-1 text-sm text-faint">
            {gregorianDate(p, locale)}
            {format === "eth" && <span className="am"> · {ethiopianDate(p)}</span>}
          </p>
        </div>
        <TimeFormatSwitch value={format} onChange={setFormat} locale={locale} id="schedule-tf" />
      </div>

      {/* Day | Week */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-full bg-ink/[0.05] p-1">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`relative min-h-10 rounded-full px-5 text-sm font-medium transition-colors ${view === v ? "text-white" : "text-muted hover:text-ink"}`}
            >
              {view === v && <motion.span layoutId="sched-view-pill" className="absolute inset-0 rounded-full bg-accent" transition={spring} />}
              <span className="relative">{t(locale, v === "day" ? "dayView" : "weekView")}</span>
            </button>
          ))}
        </div>
        <a
          href={`/api/schedule.ics?lang=${locale}`}
          download="unity-social-rem-schedule.ics"
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:bg-paper"
        >
          <CalendarPlus className="size-4 text-accent" aria-hidden />
          {t(locale, "addToCalendar")}
          <span className="hidden text-xs text-faint sm:inline">· {t(locale, "addToCalendarHint")}</span>
        </a>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {view === "day" ? (
          <motion.div key="day" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring}>
            <DayChips day={day} today={today!} entries={entries} locale={locale} onPick={pick} />
            <motion.div
              className="touch-pan-y"
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(_: unknown, info: PanInfo) => {
                if (Math.abs(info.offset.y) > 60) return;
                if (info.offset.x < -70) pick((day % 7) + 1);
                else if (info.offset.x > 70) pick(((day + 5) % 7) + 1);
              }}
            >
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.div
                  key={day}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -40 }}
                  transition={spring}
                >
                  <DayTimeline
                    day={day}
                    entries={entriesForDay(entries, day)}
                    isToday={day === today}
                    nowMin={nowMin}
                    format={format}
                    locale={locale}
                    onOpen={setDetails}
                  />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="week" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring}>
            <WeekGrid entries={entries} today={today!} format={format} locale={locale} onOpen={setDetails} />
          </motion.div>
        )}
      </AnimatePresence>

      <Stats entries={entries} locale={locale} />

      <DetailsSheet entry={details} format={format} locale={locale} onClose={() => setDetails(null)} />
    </div>
  );
}

/* ---------------- day view ---------------- */

function DayChips({ day, today, entries, locale, onPick }: { day: number; today: number; entries: ClassEntry[]; locale: Locale; onPick: (d: number) => void }) {
  return (
    <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const active = d === day;
        const count = entries.filter((e) => e.day === d).length;
        return (
          <motion.button
            key={d}
            type="button"
            onClick={() => onPick(d)}
            whileTap={{ scale: 0.93 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
            aria-pressed={active}
            className={`relative flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-2xl px-3 transition-colors ${
              active ? "text-white" : "bg-surface text-ink ring-1 ring-line"
            }`}
          >
            {active && <motion.span layoutId="day-chip" className="absolute inset-0 rounded-2xl bg-accent" transition={spring} />}
            <span className="relative text-sm font-semibold">{dayName(d, locale, true)}</span>
            <span className={`relative mt-0.5 flex h-1.5 items-center gap-0.5`} aria-hidden>
              {Array.from({ length: count }, (_, i) => (
                <span key={i} className={`size-1 rounded-full ${active ? "bg-white/80" : "bg-accent/60"}`} />
              ))}
            </span>
            {d === today && (
              <span className={`relative mt-0.5 text-[10px] font-bold tracking-wide uppercase ${active ? "text-white/90" : "text-accent-ink"}`}>
                {t(locale, "today")}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function DayTimeline({
  day,
  entries,
  isToday,
  nowMin,
  format,
  locale,
  onOpen,
}: {
  day: number;
  entries: ClassEntry[];
  isToday: boolean;
  nowMin: number;
  format: TimeFormat;
  locale: Locale;
  onOpen: (e: ClassEntry) => void;
}) {
  const height = (DAY_END - DAY_START) * PX;
  const y = (min: number) => (min - DAY_START) * PX;

  // Gaps between classes (breaks / free time)
  const gaps = useMemo(() => {
    const out: { start: number; end: number }[] = [];
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].start > entries[i - 1].end) out.push({ start: entries[i - 1].end, end: entries[i].start });
    }
    return out;
  }, [entries]);

  const showNow = isToday && nowMin >= DAY_START && nowMin <= DAY_END;

  return (
    <div className="mt-5">
      {entries.length === 0 && (
        <p className="mb-4 rounded-2xl bg-[var(--accent-tint)] px-4 py-3 text-sm text-muted">
          {t(locale, "noClassesOn", { day: dayName(day, locale) })}
        </p>
      )}
      <div className="relative" style={{ height }}>
        {/* period markers */}
        {PERIODS.map((pd) => (
          <div key={pd.n} className="absolute inset-x-0 flex items-start" style={{ top: y(pd.start) }}>
            <span className={`w-16 shrink-0 -translate-y-2 pr-2 text-right text-[11px] leading-tight text-faint tabular-nums ${format === "eth" ? "am" : ""}`}>
              {formatMinutes(pd.start, format)}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}
        <div className="absolute inset-x-0 flex items-start" style={{ top: y(DAY_END) }}>
          <span className={`w-16 shrink-0 -translate-y-2 pr-2 text-right text-[11px] text-faint ${format === "eth" ? "am" : ""}`}>
            {formatMinutes(DAY_END, format)}
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* breaks / free gaps */}
        {gaps.map((g) => {
          const len = g.end - g.start;
          const lunch = g.start <= 750 && g.end >= 810;
          return (
            <div
              key={g.start}
              className="absolute right-0 left-16 flex items-center justify-center"
              style={{ top: y(g.start), height: Math.max(len * PX, 2) }}
            >
              {len >= 15 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-paper px-3 py-1 text-xs text-faint">
                  <Coffee className="size-3.5" aria-hidden />
                  {t(locale, lunch ? "lunchBreak" : len >= 60 ? "freeTime" : "breakLabel")} · {duration(len, locale)}
                </span>
              ) : null}
            </div>
          );
        })}

        {/* classes */}
        {entries.map((e) => {
          const state = !isToday ? "upcoming" : nowMin >= e.end ? "past" : nowMin >= e.start ? "current" : "upcoming";
          const progress = state === "current" ? (nowMin - e.start) / (e.end - e.start) : 0;
          return (
            <motion.button
              key={e.id}
              type="button"
              onClick={() => onOpen(e)}
              style={{ ...subjectStyle(e.subject), top: y(e.start) + 2, height: (e.end - e.start) * PX - 4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 600, damping: 32 }}
              className={`absolute right-0 left-16 overflow-hidden rounded-2xl p-3 text-left transition-[opacity,box-shadow] sm:p-4 ${
                state === "current"
                  ? "bg-[var(--accent-soft)] ring-2 ring-accent shadow-[0_8px_24px_-14px_var(--accent)]"
                  : state === "past"
                    ? "bg-paper opacity-60 ring-1 ring-line"
                    : "bg-[var(--accent-tint)] ring-1 ring-accent/25"
              }`}
            >
              <span className="flex items-start gap-3">
                <SubjectIcon slug={e.subject} className={`size-9 shrink-0 ${state === "past" ? "grayscale" : ""}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-ink">{subjectName(e, locale)}</span>
                    {state === "past" && (
                      <span className="inline-flex items-center gap-1 text-xs text-faint">
                        <Check className="size-3.5" aria-hidden /> {t(locale, "finished")}
                      </span>
                    )}
                    {state === "current" && <LiveDot label={t(locale, "live")} />}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    <span className={format === "eth" ? "am" : ""}>
                      {formatMinutes(e.start, format)} – {formatMinutes(e.end, format)}
                    </span>{" "}
                    · {periodsText(e, locale)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    {roomName(e, locale)} · {floorText(e.floor, locale)}
                  </span>
                  {state === "current" && (
                    <span className="mt-3 block">
                      <span className="flex items-baseline justify-between text-sm">
                        <span className="text-muted">
                          {t(locale, "endsIn")} <Rolling text={duration(e.end - nowMin, locale)} className="font-semibold text-ink" />
                        </span>
                        <span className="text-xs font-medium text-accent-ink tabular-nums">{Math.floor(progress * 100)}%</span>
                      </span>
                      <FillBar value={progress} className="mt-1.5" />
                    </span>
                  )}
                  {state === "upcoming" && isToday && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
                      <Clock className="size-3.5" aria-hidden />
                      {t(locale, "inTime", { d: duration(e.start - nowMin, locale) })}
                    </span>
                  )}
                </span>
              </span>
            </motion.button>
          );
        })}

        {/* moving "now" line */}
        {showNow && (
          <motion.div
            className="pointer-events-none absolute right-0 left-12 z-10 flex items-center"
            initial={false}
            animate={{ top: y(nowMin) }}
            transition={{ type: "spring", stiffness: 120, damping: 24 }}
            aria-hidden
          >
            <span className="size-2.5 -translate-y-1/2 rounded-full bg-bad ring-4 ring-bad/15" />
            <span className="h-0.5 flex-1 -translate-y-1/2 bg-bad/80" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ---------------- week view ---------------- */

/** Rows: periods 1–4, a lunch row, periods 5–8. */
const rowOf = (period: number) => (period <= 4 ? period : period + 1) + 1; // +1 for the header row

function WeekGrid({
  entries,
  today,
  format,
  locale,
  onOpen,
}: {
  entries: ClassEntry[];
  today: number;
  format: TimeFormat;
  locale: Locale;
  onOpen: (e: ClassEntry) => void;
}) {
  return (
    <div className="mt-6">
      <div
        className="relative grid gap-1 sm:gap-1.5"
        style={{ gridTemplateColumns: "2.75rem repeat(7, minmax(0, 1fr))", gridTemplateRows: "auto repeat(4, minmax(3.25rem, auto)) 1.5rem repeat(4, minmax(3.25rem, auto))" }}
      >
        {/* today column highlight */}
        <div className="rounded-2xl bg-[var(--accent-tint)] ring-1 ring-accent/20" style={{ gridColumn: today + 1, gridRow: "1 / -1" }} aria-hidden />

        {/* header */}
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <div key={d} className="z-[1] py-2 text-center" style={{ gridColumn: d + 1, gridRow: 1 }}>
            <span className={`text-xs font-semibold sm:text-sm ${d === today ? "text-accent-ink" : "text-muted"}`}>{dayName(d, locale, true)}</span>
          </div>
        ))}

        {/* period labels */}
        {PERIODS.map((pd) => (
          <div key={pd.n} className="flex flex-col justify-center pr-1 text-right" style={{ gridColumn: 1, gridRow: rowOf(pd.n) }}>
            <span className="text-xs font-semibold text-ink/70">{pd.n}</span>
            <span className={`text-[10px] leading-tight text-faint ${format === "eth" ? "am" : ""}`}>{formatMinutes(pd.start, format).replace(/ (AM|PM)$/, "")}</span>
          </div>
        ))}
        <div className="flex items-center justify-center text-[10px] font-medium tracking-wide text-faint uppercase" style={{ gridColumn: "2 / -1", gridRow: 6 }}>
          {t(locale, "lunchBreak")}
        </div>

        {/* blocks */}
        {entries.map((e) => (
          <motion.button
            key={e.id}
            type="button"
            onClick={() => onOpen(e)}
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            style={{ ...subjectStyle(e.subject), gridColumn: e.day + 1, gridRow: `${rowOf(e.periodStart)} / ${rowOf(e.periodEnd) + 1}` }}
            className="z-[1] flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-[var(--accent-soft)] p-1 text-center ring-1 ring-accent/30 sm:items-start sm:justify-start sm:p-2.5 sm:text-left"
          >
            <SubjectIcon slug={e.subject} className="size-6 sm:size-7" />
            <span className="w-full truncate text-[10px] font-semibold text-accent-ink sm:text-xs">{subjectName(e, locale)}</span>
            <span className="hidden w-full truncate text-[11px] text-muted sm:block">{roomName(e, locale)}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- stats ---------------- */

function Stats({ entries, locale }: { entries: ClassEntry[]; locale: Locale }) {
  const s = weeklyStats(entries);
  const max = Math.max(...s.subjects.map((x) => x.minutes), 1);
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-ink">{t(locale, "thisWeek")}</h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat value={String(s.classes)} label={t(locale, "classesPerWeek")} />
        <Stat value={duration(s.totalMinutes, locale)} label={t(locale, "hoursOfClass")} />
        <Stat value={s.busiest ? dayName(s.busiest.day, locale) : "—"} label={`${t(locale, "busiestDay")}${s.busiest ? ` · ${duration(s.busiest.minutes, locale)}` : ""}`} />
      </div>
      <h3 className="mt-6 text-sm font-semibold text-muted">{t(locale, "hoursPerSubject")}</h3>
      <ul className="mt-3 space-y-3">
        {s.subjects.map((x) => (
          <li key={x.entry.subject} style={subjectStyle(x.entry.subject)} className="flex items-center gap-3">
            <SubjectIcon slug={x.entry.subject} className="size-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ink">{subjectName(x.entry, locale)}</span>
                <span className="text-muted tabular-nums">
                  {duration(x.minutes, locale)} · {x.classes}×
                </span>
              </div>
              <FillBar value={x.minutes / max} className="mt-1.5" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 ring-1 ring-line sm:p-4">
      <p className="text-lg font-semibold text-ink sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted">{label}</p>
    </div>
  );
}

/* ---------------- details sheet ---------------- */

function DetailsSheet({ entry, format, locale, onClose }: { entry: ClassEntry | null; format: TimeFormat; locale: Locale; onClose: () => void }) {
  useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [entry, onClose]);

  return (
    <AnimatePresence>
      {entry && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={subjectName(entry, locale)}
            style={subjectStyle(entry.subject)}
            className={`fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-surface px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-6 ${locale === "am" ? "am" : ""}`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={spring}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <SubjectIcon slug={entry.subject} className="size-12" />
                <div>
                  <p className="text-xl font-semibold text-ink">{subjectName(entry, locale)}</p>
                  <p className="text-sm text-muted">{dayName(entry.day, locale)}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label={t(locale, "close")} className="grid size-10 place-items-center rounded-full text-muted hover:bg-paper">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <Detail label={t(locale, "time")} value={`${formatMinutes(entry.start, format)} – ${formatMinutes(entry.end, format)}`} eth={format === "eth"} />
              <Detail label={t(locale, "periodsLabel")} value={periodsText(entry, locale)} />
              <Detail label={t(locale, "room")} value={roomName(entry, locale)} />
              <Detail label={t(locale, "floor")} value={floorText(entry.floor, locale)} />
            </dl>
            <Link
              href={`/${entry.subject}`}
              className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-medium text-white"
            >
              {t(locale, "openSubject", { subject: subjectName(entry, locale) })}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Detail({ label, value, eth = false }: { label: string; value: string; eth?: boolean }) {
  return (
    <div className="rounded-2xl bg-[var(--accent-tint)] px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 font-semibold text-ink ${eth ? "am" : ""}`}>{value}</dd>
    </div>
  );
}

export function ScheduleSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-44" />
      <Skeleton className="mt-6 h-10 w-44 !rounded-full" />
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-14 !rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton className="h-28 w-full !rounded-2xl" />
        <Skeleton className="h-20 w-full !rounded-2xl" />
        <Skeleton className="h-28 w-full !rounded-2xl" />
      </div>
    </div>
  );
}
