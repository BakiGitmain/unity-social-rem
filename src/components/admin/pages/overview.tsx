"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveRefresh, usePolling, useRealtime, useLiveStatus } from "@/components/live";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookCheck,
  BookOpen,
  Bot,
  CircleDollarSign,
  LogIn,
  Sparkles,
  Target,
  ThumbsDown,
  UserPlus,
  Users,
} from "lucide-react";
import type { Stats } from "@/lib/admin/queries";
import { recentActivity, type ActivityItem } from "@/lib/admin/actions/misc";
import { BarsChart, RangeTabs, TrendChart } from "@/components/admin/charts";
import { Kpi, pctChange } from "@/components/admin/kpi";
import { Badge, Card, CardTitle, EmptyState, PageHeader, TimeAgo, usd } from "@/components/admin/ui";
import type { FeedbackRow } from "@/lib/admin/queries";

export function OverviewView({
  stats: s,
  days,
  unreviewedDown,
  hardest,
  hitLimit,
}: {
  stats: Stats;
  days: number;
  unreviewedDown: FeedbackRow[];
  hardest: { id: string; lessonId: string; text: string; pct: number; answered: number; lesson: string }[];
  hitLimit: { id: string; username: string; messages: number }[];
}) {
  // KPIs and charts: refreshed live on sign-ups, activity and feedback (debounced), and every 60 s.
  useLiveRefresh({ key: "admin-overview", tables: ["events", "profiles", "ai_feedback"], debounceMs: 2500 });
  const budgetPct = s.ai_budget > 0 ? (s.ai_cost_month / s.ai_budget) * 100 : 0;
  const series = s.series.map((d) => ({ ...d, ai_cost: Number(d.ai_cost) }));

  return (
    <div>
      <PageHeader title="Overview" sub="How the class is using the site" actions={<RangeTabs value={days} />} />

      {budgetPct >= 80 && (
        <div role="alert" className={`mb-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${budgetPct >= 100 ? "bg-bad-soft text-bad" : "bg-tip-soft text-tip"}`}>
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">
              AI budget {budgetPct >= 100 ? "reached: Rem is paused for students" : `at ${budgetPct.toFixed(0)}%`}.
            </span>{" "}
            {usd(s.ai_cost_month)} of {usd(s.ai_budget)} this month.{" "}
            <Link href="/admin/ai" className="font-semibold underline underline-offset-2">
              Open AI settings
            </Link>
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total users" value={s.users_total} icon={<Users className="size-4" />} hint={`${s.users_new_today} new today`} />
        <Kpi label="New this week" value={s.users_new_week} change={pctChange(s.users_new_week, s.users_new_prev_week)} icon={<UserPlus className="size-4" />} hint="vs last week" />
        <Kpi label="Active today" value={s.dau} change={pctChange(s.dau, s.dau_prev)} icon={<LogIn className="size-4" />} hint={`WAU ${s.wau} · MAU ${s.mau}`} />
        <Kpi label="Lessons published" value={s.lessons_published} icon={<BookOpen className="size-4" />} hint={`${s.lessons_total} in total`} />
        <Kpi label={`Completions (${days}d)`} value={s.completions} change={pctChange(s.completions, s.completions_prev)} icon={<BookCheck className="size-4" />} hint="vs previous period" />
        <Kpi label={`Quiz attempts (${days}d)`} value={s.attempts} change={pctChange(s.attempts, s.attempts_prev)} icon={<Target className="size-4" />} hint="vs previous period" />
        <Kpi
          label="Average quiz score"
          value={s.avg_score === null ? "—" : `${s.avg_score}%`}
          change={s.avg_score !== null && s.avg_score_prev !== null ? pctChange(s.avg_score, s.avg_score_prev) : undefined}
          icon={<Sparkles className="size-4" />}
          hint={`last ${days}d`}
        />
        <Kpi label="AI messages today" value={s.ai_today} change={pctChange(s.ai_today, s.ai_yesterday)} icon={<Bot className="size-4" />} hint={`${usd(s.ai_cost_today, 3)} today`} />
        <Kpi
          label="AI cost this month"
          value={usd(s.ai_cost_month)}
          change={pctChange(s.ai_cost_month, s.ai_cost_prev_month)}
          icon={<CircleDollarSign className="size-4" />}
          hint={s.ai_budget > 0 ? `of ${usd(s.ai_budget)} budget` : "no budget set"}
          tone={budgetPct >= 100 ? "bad" : budgetPct >= 80 ? "warn" : undefined}
        >
          {s.ai_budget > 0 && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
              <motion.div
                className={`h-full rounded-full ${budgetPct >= 100 ? "bg-bad" : budgetPct >= 80 ? "bg-tip" : "bg-accent"}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, budgetPct)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 24 }}
              />
            </div>
          )}
        </Kpi>
      </div>

      {/* charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle sub={`${s.users_new_period} in the last ${days} days`}>Sign-ups</CardTitle>
          <TrendChart data={series} series={[{ key: "signups", name: "Sign-ups" }]} />
        </Card>
        <Card>
          <CardTitle sub="Distinct students with any activity">Daily active users</CardTitle>
          <TrendChart data={series} series={[{ key: "active", name: "Active users", color: "#2563c9" }]} />
        </Card>
        <Card>
          <CardTitle sub={`Last ${days} days`}>Lesson views by subject</CardTitle>
          {s.views_by_subject.length ? (
            <BarsChart data={s.views_by_subject} x="subject" y="views" name="Views" subjectColors />
          ) : (
            <EmptyState title="No lesson views yet" text="Views appear here as students open lessons." />
          )}
        </Card>
        <Card>
          <CardTitle sub="Questions asked per day">AI tutor usage</CardTitle>
          <BarsChart data={series} x="day" y="ai" name="Messages" />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ActivityFeed />
        <NeedsAttention unreviewedDown={unreviewedDown} hardest={hardest} hitLimit={hitLimit} />
      </div>
    </div>
  );
}

const EVENT_LABEL: Record<string, { label: string; tone: "accent" | "good" | "note" | "warn" | "neutral" }> = {
  signup: { label: "signed up", tone: "good" },
  login: { label: "logged in", tone: "neutral" },
  lesson_view: { label: "opened", tone: "neutral" },
  lesson_complete: { label: "completed", tone: "good" },
  quiz_start: { label: "started the quiz", tone: "note" },
  quiz_finish: { label: "finished the quiz", tone: "accent" },
  ai_message: { label: "asked Rem", tone: "warn" },
};

/** Live feed: new events arrive through Realtime (admins only, RLS); a 60 s poll is the safety net. */
function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState(false);
  const alive = useRef(true);
  const { markUpdated, setConnected } = useLiveStatus();

  const load = useCallback(async () => {
    const r = await recentActivity(20);
    if (!alive.current) return;
    if (r.ok) {
      setItems(r.data);
      setError(false);
      markUpdated();
    } else setError(true);
  }, [markUpdated]);

  useEffect(() => {
    alive.current = true;
    const first = setTimeout(() => void load(), 0);
    return () => {
      alive.current = false;
      clearTimeout(first);
    };
  }, [load]);
  usePolling(load, 60_000);
  useRealtime("admin-activity", [{ table: "events", event: "INSERT" }], () => void load(), { onStatus: setConnected, onResume: () => void load() });

  return (
    <Card>
      <CardTitle
        action={
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-good">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-good/60" />
              <span className="relative inline-flex size-2 rounded-full bg-good" />
            </span>
            Live
          </span>
        }
      >
        Recent activity
      </CardTitle>
      {error && <p className="text-sm text-bad">Could not load activity.</p>}
      {items === null && !error && (
        <div className="space-y-2" role="status">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="block h-9 animate-pulse rounded-xl bg-ink/[0.05]" />
          ))}
        </div>
      )}
      {items?.length === 0 && <EmptyState title="No activity yet" text="Sign-ups, lessons, quizzes and AI questions will show up here." />}
      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {items?.map((e) => {
            const meta = EVENT_LABEL[e.type] ?? { label: e.type, tone: "neutral" as const };
            const score = e.type === "quiz_finish" && typeof e.metadata.score === "number" ? ` · ${e.metadata.score}/${e.metadata.total}` : "";
            return (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-paper"
              >
                <Badge tone={meta.tone}>{e.type.replace("_", " ")}</Badge>
                <span className="min-w-0 flex-1 truncate text-ink/85">
                  {e.user_id ? (
                    <Link href={`/admin/users/${e.user_id}`} className="font-medium text-ink hover:underline">
                      @{e.username ?? "user"}
                    </Link>
                  ) : (
                    <span className="text-muted">A visitor</span>
                  )}{" "}
                  {meta.label} {e.lesson && <span className="text-muted">{e.lesson}</span>}
                  {score}
                </span>
                <span className="shrink-0 text-xs text-faint"><TimeAgo value={e.created_at} /></span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </Card>
  );
}

function NeedsAttention({
  unreviewedDown,
  hardest,
  hitLimit,
}: {
  unreviewedDown: FeedbackRow[];
  hardest: { id: string; lessonId: string; text: string; pct: number; answered: number; lesson: string }[];
  hitLimit: { id: string; username: string; messages: number }[];
}) {
  const nothing = !unreviewedDown.length && !hardest.length && !hitLimit.length;
  return (
    <Card>
      <CardTitle>Needs attention</CardTitle>
      {nothing && <EmptyState title="All clear" text="No thumbs-down answers, confusing questions or students at the AI limit." />}
      {unreviewedDown.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <ThumbsDown className="size-4 text-bad" aria-hidden /> {unreviewedDown.length} AI answers marked 👎
          </h3>
          <ul className="space-y-1.5">
            {unreviewedDown.slice(0, 3).map((f) => (
              <li key={f.id} className="truncate rounded-xl bg-paper px-3 py-2 text-sm text-ink/80">
                <span className="font-medium text-ink">@{f.username ?? "user"}:</span> {f.question}
              </li>
            ))}
          </ul>
          <Link href="/admin/ai#feedback" className="mt-2 inline-block text-sm font-medium text-accent-ink hover:underline">
            Review in the feedback inbox →
          </Link>
        </section>
      )}
      {hardest.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Target className="size-4 text-tip" aria-hidden /> Questions most students get wrong
          </h3>
          <ul className="space-y-1.5">
            {hardest.map((q) => (
              <li key={q.id}>
                <Link href={`/admin/content/lessons/${q.lessonId}?tab=quiz&q=${q.id}`} className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2 text-sm hover:bg-[var(--accent-tint)]">
                  <Badge tone={q.pct < 0.4 ? "bad" : "warn"}>{Math.round(q.pct * 100)}%</Badge>
                  <span className="min-w-0 flex-1 truncate text-ink/85">{q.text}</span>
                  <span className="hidden shrink-0 text-xs text-faint sm:inline">{q.lesson}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {hitLimit.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Bot className="size-4 text-note" aria-hidden /> Hit the AI limit today
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {hitLimit.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="rounded-full bg-note-soft px-3 py-1 text-sm font-medium text-note hover:underline">
                @{u.username} · {u.messages}
              </Link>
            ))}
          </div>
        </section>
      )}
    </Card>
  );
}
