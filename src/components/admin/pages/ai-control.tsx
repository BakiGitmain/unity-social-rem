"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, RotateCcw, Save, ShieldAlert, ThumbsDown, ThumbsUp } from "lucide-react";
import type { AiStats, FeedbackRow } from "@/lib/admin/queries";
import type { AiSettings } from "@/lib/settings";
import { markFeedbackReviewed, saveAiSettings, saveSystemPrompt } from "@/lib/admin/actions/settings";
import { BarsChart, RangeTabs, TrendChart } from "@/components/admin/charts";
import { ConfirmDialog } from "@/components/admin/dialog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Kpi } from "@/components/admin/kpi";
import { useToast } from "@/components/admin/toast";
import { useLiveRefresh, useServerState } from "@/components/live";
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, PageHeader, Switch, Textarea, fmtDate, TimeAgo, usd } from "@/components/admin/ui";

type Mod = { id: number; username: string | null; user_id: string | null; message: string; categories: string[]; created_at: string; lesson: string | null };

export function AiControl({
  days,
  settings,
  enabled,
  envModel,
  defaultPrompt,
  stats,
  monthSpend,
  feedback,
  moderation,
  versions,
}: {
  days: number;
  settings: AiSettings;
  enabled: boolean;
  envModel: string;
  defaultPrompt: string;
  stats: AiStats;
  monthSpend: number;
  feedback: FeedbackRow[];
  moderation: Mod[];
  versions: { id: number; prompt: string | null; created_at: string }[];
}) {
  const toast = useToast();
  const [s, setS] = useState(settings);
  const [on, setOn] = useServerState(enabled);
  const [busy, setBusy] = useState(false);
  const [offConfirm, setOffConfirm] = useState(false);
  const [prompt, setPrompt] = useState(settings.system_prompt ?? defaultPrompt);
  const [resetOpen, setResetOpen] = useState(false);
  // The feedback inbox updates live (Realtime on ai_feedback); everything else every 60 s.
  const [fb, setFb] = useServerState(feedback);
  useLiveRefresh({ key: "admin-ai", tables: ["ai_feedback"] });

  const series = stats.series.map((d) => ({ ...d, cost: Number(d.cost), tokens: Number(d.input) + Number(d.output) }));
  const totalMsgs = series.reduce((n, d) => n + Number(d.messages), 0);
  const totalCost = series.reduce((n, d) => n + d.cost, 0);
  const budgetPct = s.monthly_budget > 0 ? (monthSpend / s.monthly_budget) * 100 : 0;
  const paused = s.monthly_budget > 0 && monthSpend >= s.monthly_budget;

  const save = async (nextOn = on) => {
    setBusy(true);
    const { system_prompt: _p, ...rest } = s;
    void _p;
    const r = await saveAiSettings({ ...rest, enabled: nextOn });
    setBusy(false);
    if (r.ok) {
      toast({ title: "AI settings saved" });
    } else toast({ title: "Not saved", text: r.error, tone: "error" });
  };

  const numField = (key: keyof AiSettings, label: string, step = "1", hint?: string) => (
    <Field label={label} hint={hint}>
      <Input type="number" step={step} min={0} value={String(s[key] ?? "")} onChange={(e) => setS({ ...s, [key]: e.target.value === "" ? 0 : Number(e.target.value) })} />
    </Field>
  );

  const review = async (ids: number[], reviewed: boolean) => {
    const prev = fb;
    setFb((rows) => rows.map((r) => (ids.includes(r.id) ? { ...r, reviewed_at: reviewed ? new Date().toISOString() : null } : r)));
    const r = await markFeedbackReviewed(ids, reviewed);
    if (!r.ok) {
      setFb(prev);
      toast({ title: "Not saved", text: r.error, tone: "error" });
    }
  };

  const fbCols: Column<FeedbackRow>[] = [
    { id: "rating", header: "", sort: (f) => f.rating, cell: (f) => (f.rating < 0 ? <ThumbsDown className="size-4 text-bad" aria-label="Thumbs down" /> : <ThumbsUp className="size-4 text-good" aria-label="Thumbs up" />) },
    { id: "user", header: "Student", sort: (f) => f.username ?? "", cell: (f) => <Link href={`/admin/users/${f.user_id}`} className="font-medium text-ink hover:underline" onClick={(e) => e.stopPropagation()}>@{f.username ?? "user"}</Link> },
    { id: "question", header: "Question", sort: (f) => f.question ?? "", cell: (f) => <span className="line-clamp-2 max-w-xs text-ink">{f.question}</span> },
    { id: "answer", header: "Answer", sort: (f) => f.answer ?? "", cell: (f) => <span className="line-clamp-3 max-w-md text-muted">{f.answer}</span> },
    { id: "lesson", header: "Lesson", sort: (f) => f.lesson ?? "", cell: (f) => <span className="text-xs text-muted">{f.lesson}</span> },
    { id: "when", header: "When", sort: (f) => f.created_at, cell: (f) => <span className="text-xs text-faint"><TimeAgo value={f.created_at} /></span> },
    {
      id: "reviewed",
      header: "Reviewed",
      sort: (f) => (f.reviewed_at ? 1 : 0),
      csv: (f) => (f.reviewed_at ? "yes" : "no"),
      cell: (f) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); void review([f.id], !f.reviewed_at); }} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${f.reviewed_at ? "bg-good-soft text-good" : "bg-ink/[0.05] text-muted hover:text-ink"}`}>
          {f.reviewed_at ? <><Check className="size-3" aria-hidden /> Reviewed</> : "Mark reviewed"}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="AI tutor (Rem)" sub="Kill switch, model, limits, budget, prompt, feedback and moderation" actions={<RangeTabs value={days} />} />

      {paused && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Monthly budget reached:</span> Rem is paused and students see “Rem is resting”. Raise the budget below to turn it back on.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Status" value={!on ? "Off" : paused ? "Paused (budget)" : "On"} tone={!on || paused ? "bad" : undefined} hint={s.model || envModel} />
        <Kpi label="This month" value={usd(monthSpend)} hint={s.monthly_budget > 0 ? `${budgetPct.toFixed(0)}% of ${usd(s.monthly_budget)}` : "no budget"} tone={budgetPct >= 100 ? "bad" : budgetPct >= 80 ? "warn" : undefined} />
        <Kpi label={`Messages (${days}d)`} value={totalMsgs} hint={`${usd(totalCost, 3)} estimated`} />
        <Kpi label="Avg cost / 100 questions" value={totalMsgs ? usd((totalCost / totalMsgs) * 100, 3) : "—"} hint="estimated from token counts" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card>
            <CardTitle>Messages and cost per day</CardTitle>
            <BarsChart data={series} x="day" y="messages" name="Messages" height={180} />
            <div className="mt-4">
              <TrendChart data={series} series={[{ key: "cost", name: "Cost (USD)", color: "#b45309" }]} height={160} format={(v) => `$${v.toFixed(3)}`} />
            </div>
          </Card>
          <Card>
            <CardTitle sub="Input + output tokens per day">Tokens</CardTitle>
            <TrendChart data={series} series={[{ key: "input", name: "Input", color: "#2563c9" }, { key: "output", name: "Output", color: "#0f766e" }]} height={180} />
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardTitle>Top users</CardTitle>
              {stats.top_users.length === 0 ? <EmptyState title="No questions yet" /> : (
                <ul className="space-y-1.5 text-sm">
                  {stats.top_users.map((u) => (
                    <li key={u.id} className="flex items-center gap-2">
                      <Link href={`/admin/users/${u.id}`} className="min-w-0 flex-1 truncate font-medium text-ink hover:underline">@{u.username}</Link>
                      {u.hit_limit && <Badge tone="warn">hit limit</Badge>}
                      <span className="tabular-nums text-muted">{u.messages}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardTitle>Most-asked lessons</CardTitle>
              {stats.by_lesson.length === 0 ? <EmptyState title="No questions yet" /> : (
                <ul className="space-y-1.5 text-sm">
                  {stats.by_lesson.map((l) => (
                    <li key={l.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-ink">{l.code} {l.title_en}</span>
                      <span className="tabular-nums text-muted">{l.n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        {/* settings */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardTitle action={<Button size="sm" variant="primary" loading={busy} icon={<Save className="size-3.5" aria-hidden />} onClick={() => void save()}>Save</Button>}>Settings</CardTitle>
          <div className="space-y-4">
            <Switch
              label="AI tutor ON"
              description="Kill switch: off hides Rem for everyone immediately."
              checked={on}
              onChange={(v) => (v ? (setOn(true), void save(true)) : setOffConfirm(true))}
            />
            <Switch label="Web search" description="Only used when a question needs fresh facts. $10 per 1,000 searches." checked={s.web_search} onChange={(v) => setS({ ...s, web_search: v })} />
            <Field label="Model" hint={`Empty = OPENAI_MODEL env (${envModel})`}>
              <Input value={s.model ?? ""} placeholder={envModel} onChange={(e) => setS({ ...s, model: e.target.value || null })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {numField("daily_messages", "Questions / user / day")}
              {numField("daily_searches", "Searches / user / day")}
            </div>
            <Switch
              label="Handwriting checks (Answer Paper)"
              description="The AI reads handwritten answers when a student taps Check (low-detail image, about $0.0001 each). Off = students type their answers."
              checked={s.ink_enabled !== false}
              onChange={(v) => setS({ ...s, ink_enabled: v })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {numField("ink_daily_checks", "Handwriting checks / user / day")}
            </div>
            {numField("monthly_budget", "Monthly budget (USD)", "0.5", "At 100% Rem pauses automatically. 0 = no budget.")}
            <details className="rounded-2xl bg-paper px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-ink">Prices (USD per 1M tokens)</summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {numField("price_input", "Input", "0.01")}
                {numField("price_cached", "Cached input", "0.001")}
                {numField("price_output", "Output", "0.01")}
                {numField("price_search", "Per 1,000 searches", "0.5")}
              </div>
            </details>
          </div>
        </Card>
      </div>

      {/* prompt */}
      <Card className="mt-4">
        <CardTitle
          sub={settings.system_prompt ? "Custom prompt in use" : "Default prompt in use"}
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={() => setResetOpen(true)}>
                Reset to default
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<Save className="size-3.5" aria-hidden />}
                onClick={async () => {
                  const r = await saveSystemPrompt(prompt === defaultPrompt ? null : prompt);
                  if (r.ok) { toast({ title: "Prompt saved" }); } else toast({ title: "Not saved", text: r.error, tone: "error" });
                }}
              >
                Save prompt
              </Button>
            </div>
          }
        >
          System prompt
        </CardTitle>
        <Textarea rows={14} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="font-mono !text-[12.5px]" aria-label="System prompt" />
        <p className="mt-2 text-xs text-faint">Keep it short and stable (it is cached). The lesson context is added after it automatically.</p>
        {versions.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-ink">Version history ({versions.length})</summary>
            <ul className="mt-2 divide-y divide-line text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-muted">{v.prompt ? v.prompt.slice(0, 90) : "(reset to default)"}</span>
                  <span className="text-xs text-faint">{fmtDate(v.created_at, true)}</span>
                  <Button size="sm" variant="ghost" onClick={() => setPrompt(v.prompt ?? defaultPrompt)}>Load</Button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {/* feedback */}
      <Card className="mt-4" id="feedback">
        <CardTitle sub="👎 answers to check for quality">Feedback inbox</CardTitle>
        <DataTable
          rows={fb}
          columns={fbCols}
          rowKey={(f) => String(f.id)}
          csvName="ai-feedback"
          searchPlaceholder="Search questions and answers…"
          initialSort={{ id: "when", dir: "desc" }}
          filters={[
            { id: "rating", label: "Rating", options: [{ value: "down", label: "👎 only" }, { value: "up", label: "👍 only" }], test: (f, v) => (v === "down" ? f.rating < 0 : f.rating > 0) },
            { id: "reviewed", label: "Reviewed", options: [{ value: "no", label: "Not reviewed" }, { value: "yes", label: "Reviewed" }], test: (f, v) => (v === "yes") === !!f.reviewed_at },
          ]}
          bulkActions={(sel, clear) => (
            <Button size="sm" icon={<Check className="size-3.5" aria-hidden />} onClick={async () => { await review(sel.map((f) => f.id), true); clear(); }}>
              Mark reviewed
            </Button>
          )}
          empty={<EmptyState title="No feedback yet" />}
        />
      </Card>

      {/* moderation */}
      <Card className="mt-4">
        <CardTitle sub="Messages blocked by OpenAI moderation (never sent to the model)">Moderation log</CardTitle>
        {moderation.length === 0 ? (
          <EmptyState title="Nothing blocked" />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {moderation.map((m) => (
              <li key={m.id} className="py-2.5">
                <p className="flex flex-wrap items-center gap-2">
                  {m.user_id ? <Link href={`/admin/users/${m.user_id}`} className="font-medium text-ink hover:underline">@{m.username ?? "user"}</Link> : <span className="text-muted">deleted user</span>}
                  {m.categories.map((c) => <Badge key={c} tone="bad">{c}</Badge>)}
                  <span className="ml-auto text-xs text-faint">{fmtDate(m.created_at, true)}</span>
                </p>
                <p className="mt-1 text-ink/80">{m.message}</p>
                {m.lesson && <p className="text-xs text-faint">{m.lesson}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={offConfirm}
        onClose={() => setOffConfirm(false)}
        title="Turn the AI tutor off"
        message="Rem disappears for every student right away (the notes and quizzes still work)."
        confirmText="turn off"
        actionLabel="Turn off"
        onConfirm={async () => {
          setOn(false);
          setOffConfirm(false);
          await save(false);
        }}
      />
      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset the system prompt"
        message="Rem goes back to the default prompt from the code. The current custom prompt stays in the version history."
        confirmText="reset"
        actionLabel="Reset to default"
        danger={false}
        onConfirm={async () => {
          const r = await saveSystemPrompt(null);
          setResetOpen(false);
          if (r.ok) { setPrompt(defaultPrompt); toast({ title: "Back to the default prompt" }); } else toast({ title: "Not reset", text: r.error, tone: "error" });
        }}
      />
    </div>
  );
}
