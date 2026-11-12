"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clock, Coffee, MapPin, PartyPopper } from "lucide-react";
import { isFakeTime, useNow } from "@/lib/use-now";
import { useTimeFormat } from "@/lib/use-time-format";
import { addisParts, formatMinutes, formatTime, type TimeFormat } from "@/lib/time/clock";
import type { ClassEntry, Upcoming } from "@/lib/time/schedule";
import { isoDate, scheduleStatusOn, type DayClass, type ScheduleOverride } from "@/lib/time/overrides";
import { useSiteSettings } from "@/components/site-settings";
import { StatusBadge } from "@/components/schedule/status-badge";
import { subjectStyle } from "@/lib/subjects";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";
import { SubjectIcon } from "@/components/subject-icon";
import { Skeleton } from "@/components/skeleton";
import { FillBar, LiveDot, Rolling, TimeFormatSwitch } from "@/components/schedule/bits";
import { dayName, duration, ethiopianDate, floorText, gregorianDate, roomName, subjectName } from "@/components/schedule/format";

/** Home page "Today" card: live clock, current/next class, breaks, rest days. */
export function TodayCard({ entries, overrides, locale }: { entries: ClassEntry[]; overrides: ScheduleOverride[]; locale: Locale }) {
  const now = useNow();
  const scheduleOn = useSiteSettings().settings.features.schedule;
  const [format, setFormat] = useTimeFormat();
  const am = locale === "am" ? "am" : "";

  if (!scheduleOn) return null;
  if (now === null) return <TodayCardSkeleton />;

  const p = addisParts(now);
  const status = scheduleStatusOn(entries, overrides, isoDate(p), p.weekday, p.secondOfDay);
  const cancelled = status.plan.classes.filter((c) => c.status === "cancelled");
  const holiday = status.plan.holiday;
  const isFake = isFakeTime();

  return (
    <section className={`rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6 ${am}`} aria-label={t(locale, "today")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">
            {t(locale, "today")} · {gregorianDate(p, locale)}
            {isFake && <span className="ml-2 rounded-full bg-tip-soft px-2 py-0.5 text-[11px] font-semibold text-tip">{t(locale, "devTime")}</span>}
          </p>
          {format === "eth" && <p className="am text-sm text-faint">{ethiopianDate(p)}</p>}
          <p className={`mt-1 text-4xl font-semibold tracking-tight text-ink sm:text-5xl ${format === "eth" ? "am" : ""}`}>
            <Rolling text={formatTime(p.hour, p.minute, format, p.second)} />
          </p>
        </div>
        <TimeFormatSwitch value={format} onChange={setFormat} locale={locale} id="today-tf" />
      </div>

      {(holiday || cancelled.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {holiday && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tip-soft px-3 py-1 text-xs font-semibold text-tip">
              <PartyPopper className="size-3.5" aria-hidden />
              {t(locale, "holidayLabel")}
              {(locale === "am" ? holiday.titleAm || holiday.titleEn : holiday.titleEn) && `: ${locale === "am" ? holiday.titleAm || holiday.titleEn : holiday.titleEn}`}
            </span>
          )}
          {cancelled.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-bad-soft px-3 py-1 text-xs font-semibold text-bad">
              {subjectName(c, locale)} · {t(locale, "cancelledToday")}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={status.kind + (status.kind === "class" ? status.current.id : "")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            {status.kind === "class" && (
              <>
                <CurrentClass entry={status.current} minutesLeft={status.minutesLeft} progress={status.progress} format={format} locale={locale} />
                {status.next && <NextLine next={status.next} format={format} locale={locale} />}
              </>
            )}
            {status.kind === "before" && (
              <StatusLine icon={<Clock className="size-4" />} text={`${t(locale, "firstClassIn")} `} countdown={duration(status.next.startsIn, locale)}>
                <NextCard next={status.next} format={format} locale={locale} />
              </StatusLine>
            )}
            {status.kind === "break" && (
              <StatusLine icon={<Coffee className="size-4" />} text={`${t(locale, "breakNextIn")} `} countdown={duration(status.next.startsIn, locale)}>
                <NextCard next={status.next} format={format} locale={locale} />
              </StatusLine>
            )}
            {status.kind === "done" && (
              <div className="rounded-2xl bg-good-soft px-4 py-4">
                <p className="flex items-center gap-2 font-semibold text-good">
                  <PartyPopper className="size-4" aria-hidden />
                  {t(locale, "doneToday")}
                </p>
                {status.next && <p className="mt-1 text-sm text-ink/80">{nextClassOn(status.next, format, locale)}</p>}
              </div>
            )}
            {status.kind === "rest" && (
              <div className="flex items-center gap-4 rounded-2xl bg-[var(--accent-tint)] px-4 py-4">
                <Image src="/illustrations/rest-day.svg" alt="" width={120} height={90} loading="eager" className="h-20 w-auto shrink-0 sm:h-24" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{t(locale, "restDay")}</p>
                  <p className="mt-0.5 text-sm text-muted">{t(locale, "restDayText")}</p>
                  {status.next && <p className="mt-2 text-sm font-medium text-accent-ink">{nextClassOn(status.next, format, locale)}</p>}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex justify-end">
        <Link href="/schedule" className="group inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-accent-ink">
          {t(locale, "fullSchedule")}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function CurrentClass({
  entry,
  minutesLeft,
  progress,
  format,
  locale,
}: {
  entry: ClassEntry;
  minutesLeft: number;
  progress: number;
  format: TimeFormat;
  locale: Locale;
}) {
  return (
    <Link
      href={`/${entry.subject}`}
      style={subjectStyle(entry.subject)}
      className="card-hover block rounded-2xl bg-[var(--accent-tint)] p-4 ring-1 ring-accent/25 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-accent-ink uppercase">{t(locale, "nowInClass")}</span>
          <StatusBadge entry={entry as DayClass} locale={locale} />
        </span>
        <LiveDot label={t(locale, "live")} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <SubjectIcon slug={entry.subject} className="size-11 shrink-0" />
        <div className="min-w-0">
          <p className="text-xl font-semibold text-ink">{subjectName(entry, locale)}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {roomName(entry, locale)} · {floorText(entry.floor, locale)}
            </span>
            <span className={format === "eth" ? "am" : ""}>
              {formatMinutes(entry.start, format)} – {formatMinutes(entry.end, format)}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-2">
        <p className="text-sm text-muted">
          {t(locale, "endsIn")} <Rolling text={duration(minutesLeft, locale)} className="font-semibold text-ink" />
        </p>
        <span className="text-xs font-medium text-accent-ink tabular-nums">{Math.floor(progress * 100)}%</span>
      </div>
      <FillBar value={progress} className="mt-2" />
    </Link>
  );
}

function StatusLine({ icon, text, countdown, children }: { icon: React.ReactNode; text: string; countdown: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm text-muted">
        <span className="text-accent">{icon}</span>
        <span>
          {text}
          <Rolling text={countdown} className="font-semibold text-ink" />
        </span>
      </p>
      {children}
    </div>
  );
}

function NextCard({ next, format, locale }: { next: Upcoming; format: TimeFormat; locale: Locale }) {
  const e = next.entry;
  return (
    <Link
      href={`/${e.subject}`}
      style={subjectStyle(e.subject)}
      className="card-hover flex items-center gap-3 rounded-2xl bg-paper p-4 ring-1 ring-line hover:ring-accent/40"
    >
      <SubjectIcon slug={e.subject} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-accent-ink uppercase">
          {t(locale, "nextClass")}
          <StatusBadge entry={e as DayClass} locale={locale} />
        </p>
        <p className="font-semibold text-ink">{subjectName(e, locale)}</p>
        <p className="text-sm text-muted">
          <span className={format === "eth" ? "am" : ""}>{formatMinutes(e.start, format)}</span> · {roomName(e, locale)} ·{" "}
          {floorText(e.floor, locale)}
        </p>
      </div>
    </Link>
  );
}

function NextLine({ next, format, locale }: { next: Upcoming; format: TimeFormat; locale: Locale }) {
  const e = next.entry;
  return (
    <p className="mt-3 text-sm text-muted">
      {t(locale, "nextClass")}: <span className="font-medium text-ink">{subjectName(e, locale)}</span> ·{" "}
      <span className={format === "eth" ? "am" : ""}>
        {next.daysAhead === 0 ? formatMinutes(e.start, format) : `${dayName(e.day, locale)} ${formatMinutes(e.start, format)}`}
      </span>{" "}
      · {t(locale, "inTime", { d: duration(next.startsIn, locale) })}
    </p>
  );
}

function nextClassOn(next: Upcoming, format: TimeFormat, locale: Locale) {
  const e = next.entry;
  const day = next.daysAhead === 1 ? t(locale, "tomorrow") : dayName(e.day, locale);
  return t(locale, "nextClassOn", { day, time: formatMinutes(e.start, format), subject: subjectName(e, locale) });
}

export function TodayCardSkeleton() {
  return (
    <div className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6" aria-hidden>
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-3 h-12 w-48" />
      <Skeleton className="mt-5 h-28 w-full !rounded-2xl" />
    </div>
  );
}
