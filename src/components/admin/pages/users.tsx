"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, LogOut, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/admin/dialog";
import { useToast } from "@/components/admin/toast";
import { Badge, Button, Field, PageHeader, Select, TimeAgo, fmtDate } from "@/components/admin/ui";
import { useLiveRefresh } from "@/components/live";
import { applyUserChange, type UserChange } from "@/lib/admin/optimistic";
import { banUsers, deleteUsers, forceLogout, unbanUsers } from "@/lib/admin/actions/users";

export type AdminUser = {
  id: string;
  username: string;
  created_at: string;
  role: "student" | "admin";
  last_seen_at: string | null;
  ai_daily_limit: number | null;
  banned_until: string | null;
  /** Computed on the server at request time (banned_until is in the future). */
  banned: boolean;
  last_sign_in_at: string | null;
  lessons_completed: number;
  avg_quiz: number | null;
  quiz_attempts: number;
  ai_messages: number;
  mfa: boolean;
};

export function BanLengthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Ban length">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="24">1 day</option>
        <option value="168">1 week</option>
        <option value="720">30 days</option>
        <option value="permanent">Until unbanned</option>
      </Select>
    </Field>
  );
}

type Kind = "ban" | "unban" | "logout" | "delete";

export function UsersView({ users, me }: { users: AdminUser[]; me: string }) {
  const router = useRouter();
  const toast = useToast();
  // Optimistic list: changes show at once; when the action finishes, the server's fresh list (revalidated
  // by the action) replaces it. If the action fails, React drops the optimistic change (= rollback).
  const [rows, apply] = useOptimistic(users, (s: AdminUser[], c: UserChange) => applyUserChange(s, c));
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{ kind: Kind; ids: string[]; clear: () => void } | null>(null);
  const [length, setLength] = useState("168");
  const [reason, setReason] = useState("");

  // New sign-ups (and deletions) appear live; everything else refreshes every 60 s.
  useLiveRefresh({ key: "admin-users", tables: ["profiles"] });

  const columns: Column<AdminUser>[] = [
    {
      id: "username",
      header: "User",
      sort: (u) => u.username,
      cell: (u) => (
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink">{u.username[0]!.toUpperCase()}</span>
          <span className="font-medium text-ink">@{u.username}</span>
          {u.id === me && <Badge tone="note">you</Badge>}
        </span>
      ),
    },
    {
      id: "role",
      header: "Role",
      sort: (u) => u.role,
      cell: (u) =>
        u.role === "admin" ? (
          <Badge tone="accent">
            <ShieldCheck className="size-3" aria-hidden /> admin
          </Badge>
        ) : (
          <Badge>student</Badge>
        ),
    },
    { id: "joined", header: "Joined", sort: (u) => u.created_at, csv: (u) => u.created_at, cell: (u) => <span className="text-muted">{fmtDate(u.created_at)}</span> },
    {
      id: "seen",
      header: "Last seen",
      sort: (u) => u.last_seen_at ?? "",
      csv: (u) => u.last_seen_at,
      cell: (u) => (
        <span className="text-muted">
          <TimeAgo value={u.last_seen_at} />
        </span>
      ),
    },
    { id: "lessons", header: "Lessons done", sort: (u) => Number(u.lessons_completed), cell: (u) => <span className="tabular-nums">{u.lessons_completed}</span>, className: "text-right" },
    {
      id: "quiz",
      header: "Avg quiz",
      sort: (u) => (u.avg_quiz === null ? -1 : Number(u.avg_quiz)),
      csv: (u) => u.avg_quiz,
      cell: (u) => <span className="tabular-nums">{u.avg_quiz === null ? "—" : `${u.avg_quiz}%`}</span>,
      className: "text-right",
    },
    { id: "ai", header: "AI msgs", sort: (u) => Number(u.ai_messages), cell: (u) => <span className="tabular-nums">{u.ai_messages}</span>, className: "text-right" },
    {
      id: "status",
      header: "Status",
      sort: (u) => (u.banned ? "banned" : "active"),
      cell: (u) => (u.banned ? <Badge tone="bad">banned</Badge> : <Badge tone="good">active</Badge>),
    },
    { id: "mfa", header: "2FA", hidden: true, sort: (u) => (u.mfa ? "yes" : "no"), cell: (u) => (u.mfa ? <Badge tone="good">on</Badge> : <span className="text-faint">off</span>) },
  ];

  const confirmText = (ids: string[]) => (ids.length === 1 ? `@${rows.find((u) => u.id === ids[0])?.username ?? ""}` : `${ids.length} users`);

  const run = () => {
    if (!dialog) return;
    const { kind, ids, clear } = dialog;
    const typed = confirmText(ids);
    setDialog(null);
    clear();
    startTransition(async () => {
      if (kind === "delete") apply({ type: "delete", ids });
      else if (kind === "ban") apply({ type: "ban", ids, until: new Date(Date.now() + (length === "permanent" ? 1e11 : Number(length) * 3600e3)).toISOString() });
      else if (kind === "unban") apply({ type: "unban", ids });
      const r =
        kind === "delete"
          ? await deleteUsers(ids, typed)
          : kind === "ban"
            ? await banUsers(ids, length === "permanent" ? null : Number(length), reason)
            : kind === "unban"
              ? await unbanUsers(ids)
              : await forceLogout(ids);
      setReason("");
      if (!r.ok) {
        toast({ title: "Not done. Nothing was changed.", text: r.error, tone: "error" });
        return;
      }
      const n = ids.length;
      toast({
        title:
          kind === "delete" ? `Deleted ${n} user(s)` : kind === "ban" ? `Banned ${n} user(s)` : kind === "unban" ? `Unbanned ${n} user(s)` : `Signed out ${n} user(s)`,
      });
    });
  };

  return (
    <div>
      <PageHeader title="Users" sub={`${rows.length} accounts · ${rows.filter((u) => u.banned).length} banned`} />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(u) => u.id}
        csvName="users"
        searchPlaceholder="Search usernames…"
        initialSort={{ id: "joined", dir: "desc" }}
        onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
        filters={[
          { id: "role", label: "Role", options: [{ value: "student", label: "Students" }, { value: "admin", label: "Admins" }], test: (u, v) => u.role === v },
          { id: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "banned", label: "Banned" }], test: (u, v) => (v === "banned") === u.banned },
        ]}
        bulkActions={(selected, clear) => {
          const ids = selected.map((u) => u.id).filter((id) => id !== me);
          const deletable = selected.filter((u) => u.id !== me && u.role !== "admin").map((u) => u.id);
          return (
            <>
              <Button size="sm" icon={<LogOut className="size-3.5" aria-hidden />} onClick={() => setDialog({ kind: "logout", ids, clear })} disabled={!ids.length}>
                Force logout
              </Button>
              <Button size="sm" icon={<Ban className="size-3.5" aria-hidden />} onClick={() => setDialog({ kind: "ban", ids, clear })} disabled={!ids.length}>
                Ban
              </Button>
              <Button size="sm" icon={<Undo2 className="size-3.5" aria-hidden />} onClick={() => setDialog({ kind: "unban", ids, clear })} disabled={!ids.length}>
                Unban
              </Button>
              <Button
                size="sm"
                className="!text-bad"
                icon={<Trash2 className="size-3.5" aria-hidden />}
                onClick={() => setDialog({ kind: "delete", ids: deletable, clear })}
                disabled={!deletable.length}
                title="Admins and your own account can't be deleted here"
              >
                Delete
              </Button>
            </>
          );
        }}
      />

      <ConfirmDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog?.kind === "delete" ? "Delete users" : dialog?.kind === "ban" ? "Ban users" : dialog?.kind === "unban" ? "Unban users" : "Force logout"}
        message={
          dialog?.kind === "delete" ? (
            <>
              Permanently deletes these accounts with their progress, quiz attempts and chats. <strong>This can&apos;t be undone.</strong>
            </>
          ) : dialog?.kind === "ban" ? (
            "Banned users can't log in. Their sessions are ended now. Admins can't be banned (change their role first)."
          ) : dialog?.kind === "unban" ? (
            "These users will be able to log in again."
          ) : (
            "These users are signed out on all devices (within the hour for already-open pages)."
          )
        }
        confirmText={dialog ? confirmText(dialog.ids) : ""}
        actionLabel={dialog?.kind === "delete" ? "Delete forever" : dialog?.kind === "ban" ? "Ban" : dialog?.kind === "unban" ? "Unban" : "Sign them out"}
        danger={dialog?.kind !== "unban"}
        onConfirm={run}
      >
        {dialog?.kind === "ban" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <BanLengthPicker value={length} onChange={setLength} />
            <Field label="Reason (optional, for the audit log)">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                className="h-10 w-full rounded-xl bg-paper px-3 text-sm ring-1 ring-line focus:ring-2 focus:ring-accent/40"
              />
            </Field>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
