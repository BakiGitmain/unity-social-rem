"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Database, HardDrive, LogOut, Monitor, RefreshCw, Smartphone, XCircle } from "lucide-react";
import { healthCheck, revokeMySessions } from "@/lib/admin/actions/system";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/admin/dialog";
import { useToast } from "@/components/admin/toast";

import { Kpi } from "@/components/admin/kpi";
import { useLiveRefresh } from "@/components/live";
import { Button, Card, CardTitle, PageHeader, Sk, TimeAgo, fmtDate } from "@/components/admin/ui";

type Health = Extract<Awaited<ReturnType<typeof healthCheck>>, { ok: true }>["data"];

const bytes = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

function Status({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5 text-sm">
      {ok ? <CheckCircle2 className="size-5 text-good" aria-label="OK" /> : <XCircle className="size-5 text-bad" aria-label="Problem" />}
      <span className="min-w-0 flex-1 font-medium text-ink">{label}</span>
      {detail && <span className="text-xs text-faint">{detail}</span>}
    </li>
  );
}

export type AdminSession = { id: string; created_at: string; last_active: string; user_agent: string; ip: string; aal: string; is_current: boolean };

/** "Chrome on Windows" from a user agent (display only). */
export function describeDevice(ua: string): { label: string; phone: boolean } {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown device";
  return { label: `${browser} on ${os}`, phone: /iPhone|Android|Mobile/.test(ua) };
}

/** Active admin sessions: the 2FA code is asked once per login; sign devices out here. */
function Sessions({ sessions }: { sessions: AdminSession[] }) {
  const toast = useToast();
  const router = useRouter();
  const [confirm, setConfirm] = useState<null | { id: string | null; label: string }>(null);
  const others = sessions.filter((x) => !x.is_current).length;

  const signOutHere = async () => {
    await createClient().auth.signOut({ scope: "local" });
    router.replace("/");
  };
  const revoke = async (id: string | null) => {
    const r = await revokeMySessions(id);
    if (r.ok) toast({ title: id ? "Device signed out" : `${r.data} other device${r.data === 1 ? "" : "s"} signed out` });
    else toast({ title: "Could not sign out", text: r.error, tone: "error" });
    setConfirm(null);
  };

  return (
    <Card>
      <CardTitle sub="The 6-digit code is asked once per login on each device.">Active admin sessions</CardTitle>
      <ul className="space-y-1.5">
        {sessions.map((x) => {
          const d = describeDevice(x.user_agent);
          return (
            <li key={x.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-paper px-3 py-2.5 text-sm">
              {d.phone ? <Smartphone className="size-5 text-muted" aria-hidden /> : <Monitor className="size-5 text-muted" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">
                  {d.label}
                  {x.is_current && <span className="ml-2 rounded-full bg-good-soft px-2 py-0.5 text-xs font-medium text-good">This device</span>}
                </p>
                <p className="text-xs text-faint">
                  Last active <TimeAgo value={x.last_active} /> · signed in <TimeAgo value={x.created_at} />
                  {x.ip && ` · ${x.ip}`}
                  {x.aal === "aal2" ? " · 2FA ✓" : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={<LogOut className="size-3.5" aria-hidden />}
                onClick={() => setConfirm({ id: x.is_current ? "current" : x.id, label: x.is_current ? "this device" : d.label })}
              >
                Sign out this device
              </Button>
            </li>
          );
        })}
        {!sessions.length && <li className="text-sm text-muted">No sessions found.</li>}
      </ul>
      {others > 0 && (
        <Button className="mt-3" variant="danger" icon={<LogOut className="size-4" aria-hidden />} onClick={() => setConfirm({ id: null, label: "all other devices" })}>
          Sign out all other devices
        </Button>
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Are you sure?"
        message={<>Sign out {confirm?.label}? It will need the password and the 6-digit code again.</>}
        actionLabel="Sign out"
        onConfirm={() => (confirm?.id === "current" ? signOutHere() : revoke(confirm?.id ?? null))}
      />
    </Card>
  );
}

export function SystemView({
  stats,
  sessions = [],
}: {
  stats: { tables: Record<string, number>; storage_bytes: number; storage_files: number; db_bytes: number };
  sessions?: AdminSession[];
}) {
  useLiveRefresh({ key: "admin-system" });
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    const r = await healthCheck();
    setBusy(false);
    if (r.ok) {
      setHealth(r.data);
      setError(null);
    } else setError(r.error);
  }, []);

  // Run the checks once when the page opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
  }, [run]);

  return (
    <div>
      <PageHeader
        title="System"
        sub="Health checks, database size and storage"
        actions={
          <Button icon={<RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />} onClick={() => void run()} disabled={busy}>
            Run checks
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Database size" value={bytes(stats.db_bytes)} icon={<Database className="size-4" />} />
        <Kpi label="Storage used" value={bytes(stats.storage_bytes)} icon={<HardDrive className="size-4" />} hint={`${stats.storage_files} files`} />
        <Kpi label="Users" value={stats.tables.profiles ?? 0} />
        <Kpi label="Events logged" value={stats.tables.events ?? 0} />
      </div>
      <div className="mt-4">
        <Sessions sessions={sessions} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle sub={health ? `Checked ${fmtDate(health.checkedAt, true)}` : undefined}>Health</CardTitle>
          {error && <p className="text-sm text-bad">{error}</p>}
          {!health && !error && (
            <div className="space-y-2">
              {Array.from({ length: 7 }, (_, i) => (
                <Sk key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {health && (
            <ul className="space-y-1.5">
              <Status ok={health.supabase.ok} label="Supabase connection" detail={`${health.supabase.ms} ms`} />
              <Status ok={health.openai.ok} label="OpenAI reachable (models list, no chat)" detail={`${health.openai.ms} ms`} />
              <li className="pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">Environment variables (values never shown)</li>
              {health.env.map((e) => (
                <Status key={e.name} ok={e.present} label={e.name} detail={e.present ? "set" : "missing"} />
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Rows per table</CardTitle>
          <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {Object.entries(stats.tables)
              .sort((a, b) => b[1] - a[1])
              .map(([t, n]) => (
                <li key={t} className="flex items-center justify-between border-b border-line py-1.5 text-sm">
                  <span className="font-mono text-[12.5px] text-ink/80">{t}</span>
                  <span className="tabular-nums text-muted">{n.toLocaleString()}</span>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
