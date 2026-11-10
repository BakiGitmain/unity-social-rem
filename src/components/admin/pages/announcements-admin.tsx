"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLiveRefresh } from "@/components/live";
import { applyListChange, type ListChange } from "@/lib/admin/optimistic";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { saveAnnouncement, deleteAnnouncement, type AnnouncementInput } from "@/lib/admin/actions/announcements";
import { AnnouncementCard } from "@/components/announcement-banner";
import { ConfirmDialog, Modal } from "@/components/admin/dialog";
import { useToast } from "@/components/admin/toast";
import { Badge, BiField, Button, Card, EmptyState, Field, Input, PageHeader, Select, Switch, fmtDate } from "@/components/admin/ui";

export type AnnRow = AnnouncementInput & { id: string; created_at: string; updated_at: string };

/** datetime-local (Addis Ababa) ⇄ ISO */
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 3 * 3600e3).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(`${v}:00+03:00`).toISOString() : null);

function liveState(a: AnnRow, now: number) {
  if (!a.published) return { label: "Draft", tone: "neutral" as const };
  if (a.starts_at && new Date(a.starts_at).getTime() > now) return { label: "Scheduled", tone: "note" as const };
  if (a.ends_at && new Date(a.ends_at).getTime() <= now) return { label: "Ended", tone: "neutral" as const };
  return { label: "Live", tone: "good" as const };
}

const EMPTY: AnnouncementInput = { title_en: "", title_am: "", message_en: "", message_am: "", type: "info", link_url: null, starts_at: null, ends_at: null, audience: "everyone", published: false };

export function AnnouncementsAdmin({ rows: serverRows, openNew, now }: { rows: AnnRow[]; openNew: boolean; now: number }) {
  // Optimistic list: saves and deletions show at once; the server's fresh list takes over after the action.
  const [rows, applyRows] = useOptimistic(serverRows, (s: AnnRow[], c: ListChange<AnnRow>) => applyListChange(s, c));
  const [, startTransition] = useTransition();
  useLiveRefresh({ key: "admin-announcements", tables: ["announcements"] });
  const toast = useToast();
  const [edit, setEdit] = useState<{ id: string | null; data: AnnouncementInput } | null>(null);
  const [del, setDel] = useState<AnnRow | null>(null);
  const [previewLang, setPreviewLang] = useState<"en" | "am">("en");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openNew) setEdit({ id: null, data: EMPTY });
  }, [openNew]);

  const save = (publish?: boolean) => {
    if (!edit) return;
    const data = publish === undefined ? edit.data : { ...edit.data, published: publish };
    const id = edit.id;
    if (!data.title_en.trim()) return toast({ title: "The English title is needed", tone: "error" });
    setEdit(null);
    startTransition(async () => {
      const stamp = new Date().toISOString();
      applyRows({ type: "upsert", row: { ...data, id: id ?? `new-${stamp}`, created_at: stamp, updated_at: stamp } });
      const r = await saveAnnouncement(id, data);
      if (!r.ok) {
        toast({ title: "Not saved", text: r.error, tone: "error" });
        setEdit({ id, data }); // reopen with what was typed
        return;
      }
      toast({ title: data.published ? "Announcement is published" : "Saved as draft" });
    });
  };

  const d = edit?.data;
  return (
    <div>
      <PageHeader
        title="Announcements"
        sub="A banner at the top of every page. Students can dismiss it (remembered on their device)."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit({ id: null, data: EMPTY })}>
            New announcement
          </Button>
        }
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Megaphone className="size-6" aria-hidden />} title="No announcements yet" text="Tell the class about an exam, a holiday or a new lesson." />
        </Card>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
          {rows.map((a) => {
            const st = liveState(a, now);
            return (
              <motion.li key={a.id} layout="position" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }} transition={{ type: "spring", stiffness: 420, damping: 36 }}>
                <Card className="!p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <Badge>{a.type}</Badge>
                    <Badge>{a.audience === "logged_in" ? "logged-in only" : "everyone"}</Badge>
                    <span className="ml-auto text-xs text-faint">
                      {a.starts_at ? `from ${fmtDate(a.starts_at, true)}` : ""} {a.ends_at ? `until ${fmtDate(a.ends_at, true)}` : ""}
                    </span>
                    <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEdit({ id: a.id, data: { ...a } })} icon={<Pencil className="size-3.5" aria-hidden />} />
                    <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => setDel(a)} icon={<Trash2 className="size-3.5" aria-hidden />} />
                  </div>
                  <div className="mt-3">
                    <AnnouncementCard a={a} locale="en" />
                  </div>
                </Card>
              </motion.li>
            );
          })}
          </AnimatePresence>
        </ul>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Edit announcement" : "New announcement"}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={() => void save(false)}>Save as draft</Button>
            <Button variant="primary" onClick={() => void save(true)}>Publish</Button>
          </>
        }
      >
        {d && (
          <div className="space-y-4">
            <BiField label="Title" en={d.title_en} am={d.title_am} onChange={(v) => setEdit({ ...edit!, data: { ...d, title_en: v.en, title_am: v.am } })} />
            <BiField label="Message" multiline rows={2} en={d.message_en} am={d.message_am} onChange={(v) => setEdit({ ...edit!, data: { ...d, message_en: v.en, message_am: v.am } })} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Type">
                <Select value={d.type} onChange={(e) => setEdit({ ...edit!, data: { ...d, type: e.target.value as AnnouncementInput["type"] } })}>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </Field>
              <Field label="Who sees it">
                <Select value={d.audience} onChange={(e) => setEdit({ ...edit!, data: { ...d, audience: e.target.value as AnnouncementInput["audience"] } })}>
                  <option value="everyone">Everyone</option>
                  <option value="logged_in">Logged-in students only</option>
                </Select>
              </Field>
              <Field label="Link (optional)" hint="https://… or /geography">
                <Input value={d.link_url ?? ""} onChange={(e) => setEdit({ ...edit!, data: { ...d, link_url: e.target.value || null } })} />
              </Field>
              <Field label="Starts (Addis Ababa)" hint="Empty = now">
                <Input type="datetime-local" value={toLocal(d.starts_at)} onChange={(e) => setEdit({ ...edit!, data: { ...d, starts_at: fromLocal(e.target.value) } })} />
              </Field>
              <Field label="Ends" hint="Empty = until you remove it">
                <Input type="datetime-local" value={toLocal(d.ends_at)} onChange={(e) => setEdit({ ...edit!, data: { ...d, ends_at: fromLocal(e.target.value) } })} />
              </Field>
              <div className="pt-6">
                <Switch label="Published" checked={d.published} onChange={(v) => setEdit({ ...edit!, data: { ...d, published: v } })} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink/80">Preview</span>
                <div className="inline-flex rounded-full bg-ink/[0.05] p-0.5 text-xs">
                  {(["en", "am"] as const).map((l) => (
                    <button key={l} type="button" aria-pressed={previewLang === l} onClick={() => setPreviewLang(l)} className={`rounded-full px-2.5 py-1 font-medium ${previewLang === l ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>
                      {l === "en" ? "EN" : "አማ"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-paper p-3">
                <AnnouncementCard a={{ id: "preview", ...d, title_en: d.title_en || "Title", type: d.type }} locale={previewLang} onDismiss={() => {}} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title="Delete announcement"
        message="It disappears for everyone."
        confirmText={del?.title_en ?? ""}
        actionLabel="Delete"
        onConfirm={async () => {
          const id = del!.id;
          setDel(null);
          startTransition(async () => {
            applyRows({ type: "delete", ids: [id] });
            const r = await deleteAnnouncement(id);
            if (!r.ok) toast({ title: "Not deleted. Nothing was changed.", text: r.error, tone: "error" });
            else toast({ title: "Deleted" });
          });
        }}
      />
    </div>
  );
}
