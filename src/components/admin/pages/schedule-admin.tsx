"use client";

import { useOptimistic, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLiveRefresh } from "@/components/live";
import { applyListChange, type ListChange } from "@/lib/admin/optimistic";
import { CalendarX2, Pencil, Plus, Trash2 } from "lucide-react";
import { addOverride, deleteEntry, deleteOverride, saveEntry, saveSection, type EntryInput, type OverrideInput, type SectionInput } from "@/lib/admin/actions/schedule";
import { ConfirmDialog, Modal } from "@/components/admin/dialog";
import { useToast } from "@/components/admin/toast";
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, PageHeader, Select, Switch } from "@/components/admin/ui";

type Section = SectionInput & { id: string; slug: string };
type Entry = EntryInput & { id: string };
type Override = OverrideInput & { id: string };

const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const KIND: Record<Override["kind"], { label: string; tone: "bad" | "warn" | "good" | "note" | "accent" }> = {
  cancel: { label: "Cancelled class", tone: "bad" },
  room: { label: "Room change", tone: "warn" },
  extra: { label: "Extra class", tone: "good" },
  exam: { label: "Exam", tone: "note" },
  holiday: { label: "Holiday", tone: "accent" },
};
const hm = (t: string | null) => (t ? t.slice(0, 5) : "");
/** Today's date in Addis Ababa (YYYY-MM-DD). */
const rowAnim = {
  layout: "position" as const,
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -24, transition: { duration: 0.2 } },
  transition: { type: "spring" as const, stiffness: 420, damping: 36 },
};

export function ScheduleAdmin({
  sections,
  entries: serverEntries,
  overrides: serverOverrides,
  subjects,
  today,
}: {
  sections: Section[];
  entries: Entry[];
  overrides: Override[];
  subjects: { slug: string; name_en: string }[];
  /** Today in Addis Ababa (YYYY-MM-DD), from the server. */
  today: string;
}) {
  // Deletions show at once (and animate out); the server's fresh lists replace them when the action is done.
  const [entries, applyEntries] = useOptimistic(serverEntries, (s: Entry[], c: ListChange<Entry>) => applyListChange(s, c));
  const [overrides, applyOverrides] = useOptimistic(serverOverrides, (s: Override[], c: ListChange<Override>) => applyListChange(s, c));
  const [, startTransition] = useTransition();
  useLiveRefresh({ key: "admin-schedule" });
  const toast = useToast();
  const [sectionId, setSectionId] = useState(sections.find((s) => s.is_default)?.id ?? sections[0]?.id ?? "");
  const [editEntry, setEditEntry] = useState<Partial<Entry> | null>(null);
  const [delEntry, setDelEntry] = useState<Entry | null>(null);
  const [editSection, setEditSection] = useState<Partial<Section> | null>(null);
  const [newOverride, setNewOverride] = useState<Partial<OverrideInput> | null>(null);
  const [delOverride, setDelOverride] = useState<Override | null>(null);
  const [busy, setBusy] = useState(false);
  const subjectName = (slug: string | null) => subjects.find((s) => s.slug === slug)?.name_en ?? slug ?? "";

  const mine = entries.filter((e) => e.section_id === sectionId);
  const ovs = overrides.filter((o) => o.section_id === sectionId);
  const upcoming = ovs.filter((o) => o.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = ovs.filter((o) => o.date < today);
  const entryLabel = (id: string | null) => {
    const e = entries.find((x) => x.id === id);
    return e ? `${DAYS[e.day_of_week]} ${hm(e.start_time)} ${subjectName(e.subject_slug)}` : "—";
  };

  const done = (title: string, r: { ok: boolean; error?: string }) => {
    if (!r.ok) {
      toast({ title: "Not saved", text: r.error, tone: "error" });
      return false;
    }
    toast({ title });
    return true;
  };

  const ovKind = newOverride?.kind ?? "cancel";
  const ovDay = newOverride?.date ? (new Date(`${newOverride.date}T00:00:00Z`).getUTCDay() || 7) : null;

  return (
    <div>
      <PageHeader
        title="Schedule"
        sub="Weekly timetable and date changes (cancelled classes, room changes, extra classes, exams, holidays). Students see changes on the Today card and the Schedule page."
        actions={
          <>
            <Select aria-label="Class section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="!h-10 !w-auto !rounded-full">
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_en}
                  {s.is_default ? " (default)" : ""}
                </option>
              ))}
            </Select>
            <Button icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditSection(sections.find((s) => s.id === sectionId) ?? null)} disabled={!sectionId}>
              Section
            </Button>
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditSection({ name_en: "", name_am: "", school_en: "", school_am: "", year_ec: null, is_default: false })}>
              New section
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* timetable */}
        <Card>
          <CardTitle
            sub={`${mine.length} classes a week`}
            action={
              <Button size="sm" variant="primary" icon={<Plus className="size-3.5" aria-hidden />} disabled={!sectionId} onClick={() => setEditEntry({ section_id: sectionId, day_of_week: 1, start_time: "08:30", end_time: "09:15", period_label: "1st", period_start: 1, period_end: 1, subject_slug: subjects[0]?.slug ?? "", room_en: "", room_am: "", floor: 1 })}>
                Add class
              </Button>
            }
          >
            Weekly timetable
          </CardTitle>
          {mine.length === 0 ? (
            <EmptyState title="No classes yet" />
          ) : (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const list = mine.filter((e) => e.day_of_week === d);
                if (!list.length) return null;
                return (
                  <div key={d}>
                    <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{DAYS[d]}</p>
                    <ul className="space-y-1.5">
                      <AnimatePresence initial={false}>
                      {list.map((e) => (
                        <motion.li key={e.id} {...rowAnim} className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
                          <span className="w-24 shrink-0 tabular-nums text-muted">
                            {hm(e.start_time)}–{hm(e.end_time)}
                          </span>
                          <span className="min-w-0 flex-1 font-medium text-ink">{subjectName(e.subject_slug)}</span>
                          <span className="text-xs text-muted">
                            {e.room_en} · floor {e.floor} · P{e.period_label}
                          </span>
                          <Button size="sm" variant="ghost" aria-label="Edit class" onClick={() => setEditEntry(e)} icon={<Pencil className="size-3.5" aria-hidden />} />
                          <Button size="sm" variant="ghost" aria-label="Delete class" onClick={() => setDelEntry(e)} icon={<Trash2 className="size-3.5" aria-hidden />} />
                        </motion.li>
                      ))}
                      </AnimatePresence>
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* overrides */}
        <Card>
          <CardTitle
            sub="Changes for one date only"
            action={
              <Button size="sm" variant="primary" icon={<CalendarX2 className="size-3.5" aria-hidden />} disabled={!sectionId} onClick={() => setNewOverride({ section_id: sectionId, date: today, kind: "cancel", entry_id: null, subject_slug: null, start_time: null, end_time: null, room_en: "", room_am: "", floor: null, title_en: "", title_am: "", note_en: "", note_am: "" })}>
                Add date change
              </Button>
            }
          >
            Date overrides
          </CardTitle>
          {upcoming.length === 0 && <EmptyState title="No upcoming changes" text="Cancel a class, change a room, add an extra class, an exam or a holiday." />}
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {upcoming.map((o) => (
                <OverrideRow key={o.id} o={o} entryLabel={entryLabel} subjectName={subjectName} onDelete={() => setDelOverride(o)} />
              ))}
            </AnimatePresence>
          </ul>
          {past.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-muted">Past changes ({past.length})</summary>
              <ul className="mt-2 space-y-1.5 opacity-70">
                {past.slice(0, 50).map((o) => (
                  <OverrideRow key={o.id} o={o} entryLabel={entryLabel} subjectName={subjectName} onDelete={() => setDelOverride(o)} />
                ))}
              </ul>
            </details>
          )}
        </Card>
      </div>

      {/* entry editor */}
      <Modal
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        title={editEntry?.id ? "Edit class" : "Add class"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const r = await saveEntry(editEntry?.id ?? null, editEntry as EntryInput);
                setBusy(false);
                if (done("Class saved", r)) setEditEntry(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editEntry && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Day">
              <Select value={editEntry.day_of_week} onChange={(e) => setEditEntry({ ...editEntry, day_of_week: Number(e.target.value) })}>
                {DAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Subject">
              <Select value={editEntry.subject_slug} onChange={(e) => setEditEntry({ ...editEntry, subject_slug: e.target.value })}>
                {subjects.map((s) => <option key={s.slug} value={s.slug}>{s.name_en}</option>)}
              </Select>
            </Field>
            <Field label="Start (Addis Ababa time)"><Input type="time" value={hm(editEntry.start_time ?? "")} onChange={(e) => setEditEntry({ ...editEntry, start_time: e.target.value })} /></Field>
            <Field label="End"><Input type="time" value={hm(editEntry.end_time ?? "")} onChange={(e) => setEditEntry({ ...editEntry, end_time: e.target.value })} /></Field>
            <Field label="Period label" hint='e.g. "6th–7th"'><Input value={editEntry.period_label} onChange={(e) => setEditEntry({ ...editEntry, period_label: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="First period"><Input type="number" min={1} max={8} value={editEntry.period_start} onChange={(e) => setEditEntry({ ...editEntry, period_start: Number(e.target.value) })} /></Field>
              <Field label="Last period"><Input type="number" min={1} max={8} value={editEntry.period_end} onChange={(e) => setEditEntry({ ...editEntry, period_end: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Room (English)"><Input value={editEntry.room_en} onChange={(e) => setEditEntry({ ...editEntry, room_en: e.target.value })} /></Field>
            <Field label="Room (Amharic)"><Input className="am" value={editEntry.room_am} onChange={(e) => setEditEntry({ ...editEntry, room_am: e.target.value })} /></Field>
            <Field label="Floor"><Input type="number" min={0} max={50} value={editEntry.floor} onChange={(e) => setEditEntry({ ...editEntry, floor: Number(e.target.value) })} /></Field>
          </div>
        )}
      </Modal>

      {/* override editor */}
      <Modal
        open={!!newOverride}
        onClose={() => setNewOverride(null)}
        title="Add a date change"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewOverride(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const r = await addOverride(newOverride as OverrideInput);
                setBusy(false);
                if (done("Date change saved", r)) setNewOverride(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {newOverride && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date"><Input type="date" value={newOverride.date} onChange={(e) => setNewOverride({ ...newOverride, date: e.target.value, entry_id: null })} /></Field>
              <Field label="Type">
                <Select value={ovKind} onChange={(e) => setNewOverride({ ...newOverride, kind: e.target.value as Override["kind"] })}>
                  {(Object.keys(KIND) as Override["kind"][]).map((k) => <option key={k} value={k}>{KIND[k].label}</option>)}
                </Select>
              </Field>
            </div>
            {(ovKind === "cancel" || ovKind === "room") && (
              <Field label="Which class" hint={ovDay ? `Classes on ${DAYS[ovDay]}` : undefined}>
                <Select value={newOverride.entry_id ?? ""} onChange={(e) => setNewOverride({ ...newOverride, entry_id: e.target.value || null })}>
                  <option value="">Choose…</option>
                  {mine.filter((e) => e.day_of_week === ovDay).map((e) => <option key={e.id} value={e.id}>{hm(e.start_time)} {subjectName(e.subject_slug)} ({e.room_en})</option>)}
                </Select>
              </Field>
            )}
            {(ovKind === "extra" || ovKind === "exam") && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Subject">
                  <Select value={newOverride.subject_slug ?? ""} onChange={(e) => setNewOverride({ ...newOverride, subject_slug: e.target.value || null })}>
                    <option value="">{ovKind === "exam" ? "(none)" : "Choose…"}</option>
                    {subjects.map((s) => <option key={s.slug} value={s.slug}>{s.name_en}</option>)}
                  </Select>
                </Field>
                <Field label="Start"><Input type="time" value={newOverride.start_time ?? ""} onChange={(e) => setNewOverride({ ...newOverride, start_time: e.target.value })} /></Field>
                <Field label="End"><Input type="time" value={newOverride.end_time ?? ""} onChange={(e) => setNewOverride({ ...newOverride, end_time: e.target.value })} /></Field>
              </div>
            )}
            {(ovKind === "room" || ovKind === "extra" || ovKind === "exam") && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={ovKind === "room" ? "New room" : "Room"}><Input value={newOverride.room_en} onChange={(e) => setNewOverride({ ...newOverride, room_en: e.target.value })} /></Field>
                <Field label="Room (Amharic)"><Input className="am" value={newOverride.room_am} onChange={(e) => setNewOverride({ ...newOverride, room_am: e.target.value })} /></Field>
                <Field label="Floor"><Input type="number" min={0} max={50} value={newOverride.floor ?? ""} onChange={(e) => setNewOverride({ ...newOverride, floor: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              </div>
            )}
            {(ovKind === "holiday" || ovKind === "exam" || ovKind === "extra") && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title (English)" hint={ovKind === "holiday" ? "e.g. Meskel" : "e.g. Mid-term exam"}><Input value={newOverride.title_en} onChange={(e) => setNewOverride({ ...newOverride, title_en: e.target.value })} /></Field>
                <Field label="Title (Amharic)"><Input className="am" value={newOverride.title_am} onChange={(e) => setNewOverride({ ...newOverride, title_am: e.target.value })} /></Field>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Note (optional)"><Input value={newOverride.note_en} onChange={(e) => setNewOverride({ ...newOverride, note_en: e.target.value })} /></Field>
              <Field label="Note (Amharic)"><Input className="am" value={newOverride.note_am} onChange={(e) => setNewOverride({ ...newOverride, note_am: e.target.value })} /></Field>
            </div>
          </div>
        )}
      </Modal>

      {/* section editor */}
      <Modal
        open={!!editSection}
        onClose={() => setEditSection(null)}
        title={editSection?.id ? "Edit section" : "New section"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditSection(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const r = await saveSection(editSection?.id ?? null, editSection as SectionInput);
                setBusy(false);
                if (done("Section saved", r)) setEditSection(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editSection && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name (English)"><Input value={editSection.name_en} onChange={(e) => setEditSection({ ...editSection, name_en: e.target.value })} /></Field>
            <Field label="Name (Amharic)"><Input className="am" value={editSection.name_am} onChange={(e) => setEditSection({ ...editSection, name_am: e.target.value })} /></Field>
            <Field label="School (English)"><Input value={editSection.school_en} onChange={(e) => setEditSection({ ...editSection, school_en: e.target.value })} /></Field>
            <Field label="School (Amharic)"><Input className="am" value={editSection.school_am} onChange={(e) => setEditSection({ ...editSection, school_am: e.target.value })} /></Field>
            <Field label="Year (Ethiopian calendar)"><Input type="number" value={editSection.year_ec ?? ""} onChange={(e) => setEditSection({ ...editSection, year_ec: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <div className="pt-6">
              <Switch label="Default section" description="Shown to students" checked={!!editSection.is_default} onChange={(v) => setEditSection({ ...editSection, is_default: v })} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!delEntry}
        onClose={() => setDelEntry(null)}
        title="Delete this class"
        message={delEntry ? `${DAYS[delEntry.day_of_week]} ${hm(delEntry.start_time)} ${subjectName(delEntry.subject_slug)} is removed from the weekly timetable.` : ""}
        confirmText={delEntry ? subjectName(delEntry.subject_slug) : ""}
        actionLabel="Delete"
        onConfirm={async () => {
          const id = delEntry!.id;
          setDelEntry(null);
          startTransition(async () => {
            applyEntries({ type: "delete", ids: [id] });
            done("Class deleted", await deleteEntry(id));
          });
        }}
      />
      <ConfirmDialog
        open={!!delOverride}
        onClose={() => setDelOverride(null)}
        title="Delete this date change"
        message="The normal timetable applies again on that date."
        confirmText={delOverride?.date ?? ""}
        actionLabel="Delete"
        onConfirm={async () => {
          const id = delOverride!.id;
          setDelOverride(null);
          startTransition(async () => {
            applyOverrides({ type: "delete", ids: [id] });
            done("Date change deleted", await deleteOverride(id));
          });
        }}
      />
    </div>
  );
}

function OverrideRow({ o, entryLabel, subjectName, onDelete }: { o: Override; entryLabel: (id: string | null) => string; subjectName: (s: string | null) => string; onDelete: () => void }) {
  const k = KIND[o.kind];
  const what =
    o.kind === "cancel"
      ? entryLabel(o.entry_id)
      : o.kind === "room"
        ? `${entryLabel(o.entry_id)} → ${o.room_en}`
        : o.kind === "holiday"
          ? o.title_en || "Holiday"
          : `${o.title_en || subjectName(o.subject_slug)} ${hm(o.start_time)}–${hm(o.end_time)}`;
  return (
    <motion.li {...rowAnim} className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
      <span className="w-24 shrink-0 font-medium text-ink tabular-nums">{o.date}</span>
      <Badge tone={k.tone}>{k.label}</Badge>
      <span className="min-w-0 flex-1 truncate text-ink/85">{what}</span>
      <Button size="sm" variant="ghost" aria-label="Delete change" onClick={onDelete} icon={<Trash2 className="size-3.5" aria-hidden />} />
    </motion.li>
  );
}
