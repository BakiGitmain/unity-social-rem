"use client";

import { useState } from "react";
import Link from "next/link";
import { Reorder, useDragControls } from "framer-motion";
import { ChevronDown, FileEdit, GripVertical, Settings2 } from "lucide-react";
import { reorder, setStatus } from "@/lib/admin/actions/content";
import { useToast } from "@/components/admin/toast";
import { useLiveRefresh, useServerState } from "@/components/live";
import { Badge, Card, PageHeader, TimeAgo } from "@/components/admin/ui";
import { SUBJECT_THEMES } from "@/lib/subjects";

type Status = "published" | "draft" | "coming_soon";
type TreeLesson = { id: string; code: string; title_en: string; status: Status; sort_order: number; updated_at: string };
type TreeUnit = { id: string; number: number; label_en: string; title_en: string; status: Status; lessons: TreeLesson[] };
type TreeGrade = { id: string; number: number; name_en: string; status: Status; units: TreeUnit[] };
export type TreeSubject = { id: string; slug: string; name_en: string; status: Status; sort_order: number; color: string | null; grades: TreeGrade[] };

const STATUS_LABEL: Record<Status, string> = { published: "Published", draft: "Draft", coming_soon: "Coming soon" };

function StatusSelect({ value, onChange, label }: { value: Status; onChange: (s: Status) => void; label: string }) {
  const tone = value === "published" ? "bg-good-soft text-good" : value === "draft" ? "bg-tip-soft text-tip" : "bg-note-soft text-note";
  return (
    <select
      aria-label={`Status of ${label}`}
      value={value}
      onChange={(e) => onChange(e.target.value as Status)}
      onClick={(e) => e.stopPropagation()}
      className={`h-7 cursor-pointer rounded-full px-2.5 text-[12px] font-semibold ${tone}`}
    >
      {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

export function ContentTree({ subjects: initial, drafts }: { subjects: TreeSubject[]; drafts: string[] }) {
  const toast = useToast();
  // Follows the server (after every action and the 60 s refresh); local drags/status changes show at once.
  const [subjects, setSubjects] = useServerState(initial);
  useLiveRefresh({ key: "admin-content" });
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(initial.map((s) => [s.id, s.grades.length > 0])));

  /** Optimistic status change: update now, roll back if the server says no. */
  const changeStatus = async (table: "subjects" | "grades" | "units" | "lessons", id: string, status: Status, apply: (s: Status) => void, prev: Status) => {
    apply(status);
    const r = await setStatus(table, id, status);
    if (!r.ok) {
      apply(prev);
      toast({ title: "Status not changed", text: r.error, tone: "error" });
    } else toast({ title: `Now ${STATUS_LABEL[status].toLowerCase()}` });
  };

  const persistOrder = async (kind: "subjects" | "lessons", ids: string[]) => {
    const r = await reorder(kind, ids);
    if (!r.ok) toast({ title: "Order not saved", text: r.error, tone: "error" });
    else toast({ title: "Order saved" });
  };

  const patchSubject = (id: string, f: (s: TreeSubject) => TreeSubject) => setSubjects((all) => all.map((s) => (s.id === id ? f(s) : s)));

  return (
    <div>
      <PageHeader
        title="Content"
        sub="Subjects → Grades → Units → Lessons. Drag the handles to reorder. Drafts are hidden from students."
      />
      <Reorder.Group axis="y" values={subjects} onReorder={setSubjects} className="space-y-3">
        {subjects.map((s) => (
          <SubjectRow
            key={s.id}
            s={s}
            open={!!open[s.id]}
            onToggle={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
            onDragEnd={() => void persistOrder("subjects", subjects.map((x) => x.id))}
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusSelect
                label={s.name_en}
                value={s.status}
                onChange={(st) => changeStatus("subjects", s.id, st, (v) => patchSubject(s.id, (x) => ({ ...x, status: v })), s.status)}
              />
              <Link href={`/admin/content/subjects/${s.id}`} className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-muted ring-1 ring-line hover:text-ink">
                <Settings2 className="size-3.5" aria-hidden /> Settings
              </Link>
            </div>
            {open[s.id] && (
              <div className="mt-3 space-y-3 border-t border-line pt-3">
                {s.grades.length === 0 && <p className="px-1 text-sm text-faint">No grades yet. New grades, units and lessons are added by Claude Code through migrations.</p>}
                {s.grades.map((g) => (
                  <div key={g.id} className="rounded-2xl bg-paper p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{g.name_en}</p>
                      <StatusSelect
                        label={g.name_en}
                        value={g.status}
                        onChange={(st) =>
                          changeStatus("grades", g.id, st, (v) => patchSubject(s.id, (x) => ({ ...x, grades: x.grades.map((gg) => (gg.id === g.id ? { ...gg, status: v } : gg)) })), g.status)
                        }
                      />
                    </div>
                    <div className="mt-2 space-y-2">
                      {g.units.map((u) => (
                        <div key={u.id} className="rounded-xl bg-surface p-3 ring-1 ring-line">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm text-ink">
                              <span className="font-semibold">{u.label_en}</span> · {u.title_en}
                            </p>
                            <StatusSelect
                              label={u.label_en}
                              value={u.status}
                              onChange={(st) =>
                                changeStatus(
                                  "units",
                                  u.id,
                                  st,
                                  (v) =>
                                    patchSubject(s.id, (x) => ({
                                      ...x,
                                      grades: x.grades.map((gg) => (gg.id === g.id ? { ...gg, units: gg.units.map((uu) => (uu.id === u.id ? { ...uu, status: v } : uu)) } : gg)),
                                    })),
                                  u.status,
                                )
                              }
                            />
                          </div>
                          <LessonList
                            lessons={u.lessons}
                            drafts={drafts}
                            onReorder={(ls) =>
                              patchSubject(s.id, (x) => ({
                                ...x,
                                grades: x.grades.map((gg) => (gg.id === g.id ? { ...gg, units: gg.units.map((uu) => (uu.id === u.id ? { ...uu, lessons: ls } : uu)) } : gg)),
                              }))
                            }
                            onPersist={(ids) => void persistOrder("lessons", ids)}
                            onStatus={(l, st) =>
                              changeStatus(
                                "lessons",
                                l.id,
                                st,
                                (v) =>
                                  patchSubject(s.id, (x) => ({
                                    ...x,
                                    grades: x.grades.map((gg) =>
                                      gg.id === g.id
                                        ? { ...gg, units: gg.units.map((uu) => (uu.id === u.id ? { ...uu, lessons: uu.lessons.map((ll) => (ll.id === l.id ? { ...ll, status: v } : ll)) } : uu)) }
                                        : gg,
                                    ),
                                  })),
                                l.status,
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SubjectRow>
        ))}
      </Reorder.Group>
    </div>
  );
}

function SubjectRow({
  s,
  open,
  onToggle,
  onDragEnd,
  children,
}: {
  s: TreeSubject;
  open: boolean;
  onToggle: () => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}) {
  const controls = useDragControls();
  const color = s.color ?? SUBJECT_THEMES[s.slug]?.accent ?? "var(--accent)";
  const lessons = s.grades.reduce((n, g) => n + g.units.reduce((m, u) => m + u.lessons.length, 0), 0);
  return (
    <Reorder.Item value={s} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} className="list-none">
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label={`Drag to reorder ${s.name_en}`}
            onPointerDown={(e) => controls.start(e)}
            className="grid size-8 cursor-grab touch-none place-items-center rounded-lg text-faint hover:bg-ink/[0.05] active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
          <span className="size-3 rounded-full" style={{ background: color }} aria-hidden />
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="truncate text-[15px] font-semibold text-ink">{s.name_en}</span>
            <span className="text-xs text-faint">{lessons} lessons</span>
            <ChevronDown className={`size-4 text-faint transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </div>
        <div className="mt-2 pl-11">{children}</div>
      </Card>
    </Reorder.Item>
  );
}

function LessonList({
  lessons,
  drafts,
  onReorder,
  onPersist,
  onStatus,
}: {
  lessons: TreeLesson[];
  drafts: string[];
  onReorder: (ls: TreeLesson[]) => void;
  onPersist: (ids: string[]) => void;
  onStatus: (l: TreeLesson, s: Status) => void;
}) {
  if (!lessons.length) return <p className="mt-2 text-xs text-faint">No lessons yet.</p>;
  return (
    <Reorder.Group axis="y" values={lessons} onReorder={onReorder} className="mt-2 space-y-1">
      {lessons.map((l) => (
        <LessonRow key={l.id} l={l} draft={drafts.includes(l.id)} onDragEnd={() => onPersist(lessons.map((x) => x.id))} onStatus={(s) => onStatus(l, s)} />
      ))}
    </Reorder.Group>
  );
}

function LessonRow({ l, draft, onDragEnd, onStatus }: { l: TreeLesson; draft: boolean; onDragEnd: () => void; onStatus: (s: Status) => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={l} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} className="list-none">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-2 py-1.5">
        <button
          type="button"
          aria-label={`Drag to reorder ${l.code}`}
          onPointerDown={(e) => controls.start(e)}
          className="grid size-7 cursor-grab touch-none place-items-center rounded-lg text-faint hover:bg-ink/[0.05] active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
        <span className="rounded-lg bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink tabular-nums">{l.code}</span>
        <Link href={`/admin/content/lessons/${l.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline">
          {l.title_en}
        </Link>
        {l.status === "draft" && <Badge tone="warn">Draft</Badge>}
        {draft && <Badge tone="note">unsaved edits</Badge>}
        <span className="hidden text-xs text-faint sm:inline">edited <TimeAgo value={l.updated_at} /></span>
        <StatusSelect label={l.code} value={l.status} onChange={onStatus} />
        <Link href={`/admin/content/lessons/${l.id}`} aria-label={`Edit ${l.code}`} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-ink/[0.05] hover:text-ink">
          <FileEdit className="size-3.5" aria-hidden />
        </Link>
      </div>
    </Reorder.Item>
  );
}
