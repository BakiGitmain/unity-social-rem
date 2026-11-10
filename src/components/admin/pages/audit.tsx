"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { useLiveRefresh } from "@/components/live";
import { Modal } from "@/components/admin/dialog";
import { Badge, Field, Input, PageHeader, fmtDate } from "@/components/admin/ui";

export type AuditRow = {
  id: number;
  admin_id: string | null;
  admin_username: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
};

const tone = (a: string): "bad" | "warn" | "note" | "neutral" =>
  /delete|ban|disable|maintenance\.on|reset/.test(a) ? "bad" : /role|rename|status|limit|logout|prompt/.test(a) ? "warn" : /view_chat/.test(a) ? "note" : "neutral";

/** Read-only: the log can't be edited or deleted (database triggers block it). */
export function AuditView({ rows }: { rows: AuditRow[] }) {
  useLiveRefresh({ key: "admin-audit" });
  const [open, setOpen] = useState<AuditRow | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const d = new Date(new Date(r.created_at).getTime() + 3 * 3600e3).toISOString().slice(0, 10);
        return (!from || d >= from) && (!to || d <= to);
      }),
    [rows, from, to],
  );
  const admins = [...new Set(rows.map((r) => r.admin_username ?? "?"))];
  const actions = [...new Set(rows.map((r) => r.action))].sort();

  const columns: Column<AuditRow>[] = [
    { id: "when", header: "When", sort: (r) => r.created_at, csv: (r) => r.created_at, cell: (r) => <span className="whitespace-nowrap text-muted">{fmtDate(r.created_at, true)}</span> },
    { id: "admin", header: "Admin", sort: (r) => r.admin_username ?? "", cell: (r) => <span className="font-medium text-ink">@{r.admin_username ?? "?"}</span> },
    { id: "action", header: "Action", sort: (r) => r.action, cell: (r) => <Badge tone={tone(r.action)}>{r.action}</Badge> },
    {
      id: "target",
      header: "Target",
      sort: (r) => `${r.target_type ?? ""}:${r.target_id ?? ""}`,
      cell: (r) => (
        <span className="font-mono text-[12px] text-muted">
          {r.target_type}
          {r.target_id ? `:${r.target_id.slice(0, 18)}` : ""}
        </span>
      ),
    },
    {
      id: "change",
      header: "Change",
      csv: (r) => JSON.stringify({ before: r.before, after: r.after }),
      cell: (r) => (r.before || r.after ? <span className="text-xs text-accent-ink">view</span> : <span className="text-faint">—</span>),
    },
  ];

  return (
    <div>
      <PageHeader title="Audit log" sub="Every admin action. Append-only: nobody can edit or delete entries." />
      <div className="mb-3 grid max-w-md grid-cols-2 gap-3">
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => String(r.id)}
        csvName="audit-log"
        searchPlaceholder="Search actions, targets…"
        initialSort={{ id: "when", dir: "desc" }}
        onRowClick={(r) => setOpen(r)}
        filters={[
          { id: "admin", label: "Admin", options: admins.map((a) => ({ value: a, label: `@${a}` })), test: (r, v) => (r.admin_username ?? "?") === v },
          { id: "action", label: "Action", options: actions.map((a) => ({ value: a, label: a })), test: (r, v) => r.action === v },
        ]}
      />
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.action ?? ""} wide>
        {open && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              @{open.admin_username} · {fmtDate(open.created_at, true)} · {open.target_type}:{open.target_id}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {(["before", "after"] as const).map((k) => (
                <div key={k}>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{k}</p>
                  <pre className="max-h-96 overflow-auto rounded-xl bg-paper p-3 text-[12px] leading-relaxed whitespace-pre-wrap text-ink/85">
                    {open[k] ? JSON.stringify(open[k], null, 2) : "—"}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
