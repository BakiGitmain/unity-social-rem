"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useLiveRefresh } from "@/components/live";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Ban, Bot, Copy, Eye, KeyRound, LogOut, PencilLine, ShieldCheck, Trash2, Undo2, UserCog } from "lucide-react";
import { SetCrumb } from "@/components/admin/shell";
import { ConfirmDialog, Modal } from "@/components/admin/dialog";
import { useToast } from "@/components/admin/toast";
import { BarsChart } from "@/components/admin/charts";
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, Select, fmtDate, TimeAgo } from "@/components/admin/ui";
import { BanLengthPicker, type AdminUser } from "@/components/admin/pages/users";
import {
  banUsers,
  changeRole,
  changeUsername,
  deleteUser,
  forceLogout,
  resetPassword,
  setAiLimit,
  unbanUsers,
  viewUserChat,
} from "@/lib/admin/actions/users";

type Lesson = { id: string; code: string; title: string; subject: string };
type Ev = { id: number; type: string; created_at: string; lesson_id: string | null; metadata: unknown };
type Prog = { lesson_id: string; parts_done: number[]; total_parts: number; completed_at: string | null; best_quiz_score: number | null; best_quiz_total: number | null; updated_at: string };
type Att = { id: number; lesson_id: string; score: number; total: number; duration_ms: number | null; created_at: string };
type Usage = { day: string; messages: number; searches: number; input_tokens: number; output_tokens: number };

type Dialog = "role" | "ban" | "unban" | "logout" | "password" | "rename" | "limit" | "delete" | null;

export function UserDetailView({
  user,
  me,
  events,
  progress,
  attempts,
  usage,
  chats,
  lessons,
  notes = null,
}: {
  /** Notes are private: admins only see counts and storage used, never the content. */
  notes?: { boards: number; cards: number; flashcards: number; storage_bytes: number } | null;
  user: AdminUser;
  me: string;
  events: Ev[];
  progress: Prog[];
  attempts: Att[];
  usage: Usage[];
  chats: { lesson_id: string; updated_at: string }[];
  lessons: Lesson[];
}) {
  const router = useRouter();
  const toast = useToast();
  // Optimistic copy of the user: changes show at once, then the server's fresh data (revalidated by the
  // action) takes over. A failed action drops the change again (rollback) and shows an error toast.
  const [u, patchU] = useOptimistic(user, (cur: AdminUser, p: Partial<AdminUser>) => ({ ...cur, ...p }));
  const [, startTransition] = useTransition();
  useLiveRefresh({ key: `admin-user-${user.id}` });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [length, setLength] = useState("168");
  const [reason, setReason] = useState("");
  const [newName, setNewName] = useState(user.username);
  const [limit, setLimit] = useState(user.ai_daily_limit === null ? "" : String(user.ai_daily_limit));
  const [role, setRole] = useState<"student" | "admin">(user.role === "admin" ? "student" : "admin");
  const [password, setPassword] = useState<string | null>(null);
  const [chat, setChat] = useState<{ lesson: string; messages: { id: string; role: string; text: string }[] } | null>(null);
  const self = u.id === me;
  const banned = u.banned;
  const L = new Map(lessons.map((l) => [l.id, l]));
  const lessonName = (id: string | null) => (id && L.get(id) ? `${L.get(id)!.code} ${L.get(id)!.title}` : "—");

  /** Close the dialog, show the change at once, then confirm with the server. */
  const act = (title: string, patch: Partial<AdminUser> | null, call: () => Promise<{ ok: boolean; error?: string }>) => {
    setDialog(null);
    startTransition(async () => {
      if (patch) patchU(patch);
      const r = await call();
      if (!r.ok) toast({ title: "Not done. Nothing was changed.", text: r.error, tone: "error" });
      else toast({ title });
    });
  };

  const actions = [
    { key: "role" as const, label: "Change role", icon: UserCog, disabled: self },
    banned ? { key: "unban" as const, label: "Unban", icon: Undo2 } : { key: "ban" as const, label: "Ban", icon: Ban, disabled: self || u.role === "admin" },
    { key: "password" as const, label: "Reset password", icon: KeyRound, disabled: self },
    { key: "rename" as const, label: "Change username", icon: PencilLine },
    { key: "limit" as const, label: "AI daily limit", icon: Bot },
    { key: "logout" as const, label: "Force logout", icon: LogOut, disabled: self },
    { key: "delete" as const, label: "Delete user", icon: Trash2, disabled: self || u.role === "admin", danger: true },
  ];

  const totalAi = usage.reduce((n, x) => n + x.messages, 0);

  return (
    <div>
      <SetCrumb label={`@${u.username}`} />

      {/* header */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-xl font-semibold text-accent-ink">{u.username[0]!.toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-ink">
              @{u.username}
              {u.role === "admin" ? (
                <Badge tone="accent">
                  <ShieldCheck className="size-3" aria-hidden /> admin
                </Badge>
              ) : (
                <Badge>student</Badge>
              )}
              {banned ? <Badge tone="bad">banned until {fmtDate(u.banned_until)}</Badge> : <Badge tone="good">active</Badge>}
              {u.mfa && <Badge tone="good">2FA on</Badge>}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Joined {fmtDate(u.created_at)} · last seen <TimeAgo value={u.last_seen_at} /> · last login <TimeAgo value={u.last_sign_in_at} />
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Lessons completed", u.lessons_completed],
            ["Average quiz", u.avg_quiz === null ? "—" : `${u.avg_quiz}%`],
            ["Quiz attempts", u.quiz_attempts],
            ["AI messages", `${u.ai_messages}${u.ai_daily_limit !== null ? ` · limit ${u.ai_daily_limit}/day` : ""}`],
            ...(notes
              ? [
                  ["Note boards", notes.boards],
                  ["Note cards", `${notes.cards} · ${notes.flashcards} flashcards`],
                  ["Note images", notes.storage_bytes > 1e6 ? `${(notes.storage_bytes / 1e6).toFixed(1)} MB` : `${Math.round(notes.storage_bytes / 1e3)} KB`],
                ]
              : []),
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-2xl bg-paper px-4 py-3">
              <p className="text-xs text-muted">{k}</p>
              <p className="mt-0.5 font-semibold text-ink tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.key}
              size="sm"
              variant={"danger" in a && a.danger ? "ghost" : "secondary"}
              className={"danger" in a && a.danger ? "!text-bad hover:!bg-bad-soft" : ""}
              disabled={"disabled" in a ? a.disabled : false}
              icon={<a.icon className="size-3.5" aria-hidden />}
              onClick={() => setDialog(a.key)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* progress */}
        <Card>
          <CardTitle sub={`${progress.filter((p) => p.completed_at).length} of ${lessons.length} lessons completed`}>Progress per lesson</CardTitle>
          {progress.length === 0 ? (
            <EmptyState title="No saved progress yet" />
          ) : (
            <ul className="space-y-3">
              {progress.map((p) => {
                const pct = p.total_parts ? Math.round((p.parts_done.length / p.total_parts) * 100) : 0;
                return (
                  <li key={p.lesson_id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-ink">{lessonName(p.lesson_id)}</span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {pct}%{p.best_quiz_total ? ` · quiz ${p.best_quiz_score}/${p.best_quiz_total}` : ""}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                      <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 24 }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* quiz attempts */}
        <Card>
          <CardTitle sub={`${attempts.length} attempts`}>Quiz attempts</CardTitle>
          {attempts.length === 0 ? (
            <EmptyState title="No quiz attempts yet" />
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                  <Badge tone={a.score / a.total >= 0.7 ? "good" : a.score / a.total >= 0.5 ? "warn" : "bad"}>
                    {a.score}/{a.total}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-ink">{lessonName(a.lesson_id)}</span>
                  <span className="shrink-0 text-xs text-faint">
                    {a.duration_ms ? `${Math.round(a.duration_ms / 60000)} min · ` : ""}
                    <TimeAgo value={a.created_at} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* AI usage + chats */}
        <Card>
          <CardTitle sub={`${totalAi} questions in the last 60 days`}>AI usage</CardTitle>
          {usage.length ? <BarsChart data={[...usage].reverse()} x="day" y="messages" name="Messages" height={160} /> : <EmptyState title="Hasn't asked Rem yet" />}
          <h3 className="mt-5 mb-2 text-[13px] font-semibold text-ink">AI chat history</h3>
          <p className="mb-2 text-xs text-faint">Opening a chat is recorded in the audit log.</p>
          {chats.length === 0 ? (
            <p className="text-sm text-muted">No saved chats.</p>
          ) : (
            <ul className="space-y-1.5">
              {chats.map((c) => (
                <li key={c.lesson_id} className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{lessonName(c.lesson_id)}</span>
                  <span className="text-xs text-faint"><TimeAgo value={c.updated_at} /></span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Eye className="size-3.5" aria-hidden />}
                    onClick={async () => {
                      const r = await viewUserChat(u.id, c.lesson_id);
                      if (r.ok) setChat({ lesson: lessonName(c.lesson_id), messages: r.data.messages });
                      else toast({ title: "Could not open the chat", text: r.error, tone: "error" });
                    }}
                  >
                    View
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* timeline */}
        <Card>
          <CardTitle sub="Last 100 events">Activity timeline</CardTitle>
          {events.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ol className="relative max-h-96 space-y-3 overflow-y-auto border-l border-line pl-4">
              {events.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-accent ring-4 ring-surface" aria-hidden />
                  <p className="text-ink">
                    <span className="font-medium">{e.type.replace("_", " ")}</span>
                    {e.lesson_id && <span className="text-muted"> · {lessonName(e.lesson_id)}</span>}
                  </p>
                  <p className="text-xs text-faint">{fmtDate(e.created_at, true)}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* ---------- dialogs ---------- */}
      <ConfirmDialog
        open={dialog === "role"}
        onClose={() => setDialog(null)}
        title="Change role"
        message={<>Admins can open this dashboard (with 2FA). Students can&apos;t. You can&apos;t change your own role.</>}
        actionLabel={`Make ${role}`}
        onConfirm={async () => {
          act(`@${u.username} is now ${role}`, { role }, () => changeRole(u.id, role));
        }}
      >
        <Field label="New role">
          <Select value={role} onChange={(e) => setRole(e.target.value as "student" | "admin")}>
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "ban"}
        onClose={() => setDialog(null)}
        title={`Ban @${u.username}`}
        message="They can't log in until the ban ends, and their sessions are ended now."
        actionLabel="Ban"
        onConfirm={async () => {
          act(`@${u.username} is banned`, { banned: true, banned_until: new Date(Date.now() + (length === "permanent" ? 1e11 : Number(length) * 3600e3)).toISOString() }, () =>
            banUsers([u.id], length === "permanent" ? null : Number(length), reason),
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <BanLengthPicker value={length} onChange={setLength} />
          <Field label="Reason (optional)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </Field>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "unban"}
        onClose={() => setDialog(null)}
        title={`Unban @${u.username}`}
        message="They will be able to log in again."
        actionLabel="Unban"
        danger={false}
        onConfirm={async () => {
          act(`@${u.username} is unbanned`, { banned: false, banned_until: null }, () => unbanUsers([u.id]));
        }}
      />

      <ConfirmDialog
        open={dialog === "logout"}
        onClose={() => setDialog(null)}
        title={`Sign out @${u.username}`}
        message="Ends their sessions on all devices. Pages already open stop working within the hour."
        actionLabel="Sign out everywhere"
        onConfirm={async () => {
          act(`@${u.username} was signed out`, null, () => forceLogout([u.id]));
        }}
      />

      <ConfirmDialog
        open={dialog === "password" && !password}
        onClose={() => setDialog(null)}
        title={`Reset the password of @${u.username}`}
        message="A temporary password is created and shown ONCE. Give it to the student in person; they're signed out everywhere."
        actionLabel="Create temporary password"
        onConfirm={async () => {
          const r = await resetPassword(u.id);
          if (r.ok) setPassword(r.data.password);
          else toast({ title: "Not done", text: r.error, tone: "error" });
        }}
      />
      <Modal
        open={!!password}
        onClose={() => {
          setPassword(null);
          setDialog(null);
        }}
        title="Temporary password"
        footer={
          <Button variant="primary" onClick={() => { setPassword(null); setDialog(null); }}>
            Done
          </Button>
        }
      >
        <p className="text-sm text-muted">Shown only now. Write it down and give it to @{u.username}.</p>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-paper px-4 py-3">
          <code className="flex-1 font-mono text-xl tracking-wide text-ink select-all">{password}</code>
          <Button
            size="sm"
            icon={<Copy className="size-3.5" aria-hidden />}
            onClick={() => {
              void navigator.clipboard.writeText(password ?? "");
              toast({ title: "Copied" });
            }}
          >
            Copy
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={dialog === "rename"}
        onClose={() => setDialog(null)}
        title={`Change the username of @${u.username}`}
        message="The new username is also their login name. Tell them before they log in next time."
        actionLabel="Change username"
        danger={false}
        onConfirm={async () => {
          const name = newName.trim().toLowerCase();
          act("Username changed", { username: name }, () => changeUsername(u.id, name));
        }}
      >
        <Field label="New username" hint="3–20 characters: a-z, 0-9 or _">
          <Input value={newName} onChange={(e) => setNewName(e.target.value.toLowerCase())} maxLength={20} />
        </Field>
      </ConfirmDialog>

      <Modal
        open={dialog === "limit"}
        onClose={() => setDialog(null)}
        title={`AI daily limit for @${u.username}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const v = limit.trim() === "" ? null : Number(limit);
                act("AI limit saved", { ai_daily_limit: v }, () => setAiLimit(u.id, v));
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Questions per day" hint="Leave empty to use the default from Admin → AI tutor. 0 = no AI for this user.">
          <Input type="number" min={0} max={1000} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="default" />
        </Field>
      </Modal>

      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title={`Delete @${u.username}`}
        message={<>This permanently deletes the account, their progress, quiz attempts and chats. <strong>This can&apos;t be undone.</strong></>}
        confirmText={u.username}
        actionLabel="Delete forever"
        onConfirm={async () => {
          const r = await deleteUser(u.id, u.username);
          if (r.ok) {
            toast({ title: `@${u.username} was deleted` });
            router.push("/admin/users");
          } else toast({ title: "Not deleted", text: r.error, tone: "error" });
        }}
      />

      <Modal open={!!chat} onClose={() => setChat(null)} title={`Chat · ${chat?.lesson ?? ""}`} wide>
        {chat?.messages.length === 0 && <p className="text-sm text-muted">This chat is empty.</p>}
        <ol className="space-y-3">
          {chat?.messages.map((m) => (
            <li key={m.id} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-accent text-white" : "bg-paper text-ink"}`}>{m.text}</div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-faint">
          This view was recorded in the <Link href="/admin/audit" className="underline">audit log</Link>.
        </p>
      </Modal>
    </div>
  );
}
