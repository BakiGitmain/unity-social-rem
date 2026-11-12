"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  GripVertical,
  History,
  Monitor,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import type { Block, Lang, LessonSection } from "@/lib/types";
import {
  BLOCK_TYPES,
  validateLesson,
  type EditorData,
  type EditorQuestion,
  type EditorSection,
} from "@/lib/admin/lesson-validate";
import { discardLessonDraft, lessonVersions, publishLesson, restoreLessonVersion, saveLessonDraft, setStatus } from "@/lib/admin/actions/content";
import { SetCrumb } from "@/components/admin/shell";
import { ConfirmDialog, Modal } from "@/components/admin/dialog";
import { useToast } from "@/components/admin/toast";
import { BiField, Button, Card, CardTitle, ErrorState, Field, Input, Select, fmtDate, TimeAgo } from "@/components/admin/ui";
import { BLOCK_LABEL, BlockEditor, IconPicker, newBlock } from "@/components/admin/pages/block-editor";
import { LearnMode } from "@/components/study/learn-mode";
import { ReadAll } from "@/components/study/study-view";
import { MainTopics } from "@/components/study/main-topics";
import { GlossaryProvider } from "@/components/study/glossary";
import { LanguageToggle } from "@/components/study/language-toggle";
import { HomeworkEditor, RegionsInput, SetValueInput, VennDataEditor } from "@/components/admin/pages/math-editors";

type Tab = "details" | "parts" | "terms" | "topics" | "homework" | "practice" | "quiz" | "preview";
const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "parts", label: "Parts" },
  { id: "terms", label: "Key terms" },
  { id: "topics", label: "Main topics" },
  { id: "homework", label: "Homework" },
  { id: "practice", label: "Extra practice" },
  { id: "quiz", label: "Quiz" },
  { id: "preview", label: "Preview" },
];
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

export function LessonEditor({
  live,
  draft,
  initialTab,
  focusQuestion,
  publicHref,
}: {
  live: EditorData;
  draft: { data: EditorData; updated_at: string } | null;
  initialTab?: string;
  focusQuestion?: string;
  publicHref: string | null;
}) {
  const toast = useToast();
  const [data, setData] = useState<EditorData>(draft?.data ?? live);
  const [hasDraft, setHasDraft] = useState(!!draft);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "error">(draft ? "saved" : "saved");
  const [savedAt, setSavedAt] = useState<string | null>(draft?.updated_at ?? null);
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : "parts");
  const [status, setLessonStatus] = useState(live.lesson.status);
  const [publishOpen, setPublishOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const first = useRef(true);

  const problems = useMemo(() => validateLesson(data), [data]);
  const lessonId = live.lesson.id;

  // Autosave the working copy 2.5 s after the last change.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState("dirty");
    const t = setTimeout(async () => {
      setSaveState("saving");
      const r = await saveLessonDraft(lessonId, data);
      if (r.ok) {
        setSaveState("saved");
        setSavedAt(r.data);
        setHasDraft(true);
      } else setSaveState("error");
    }, 2500);
    return () => clearTimeout(t);
  }, [data, lessonId]);

  const patch = (f: (d: EditorData) => EditorData) => setData((d) => f(structuredClone(d)));

  const publish = async () => {
    setBusy(true);
    const r = await publishLesson(lessonId, data, note);
    setBusy(false);
    if (!r.ok) return toast({ title: "Not published", text: r.error, tone: "error" });
    toast({ title: "Published", text: "Students see the new version now." });
    setPublishOpen(false);
    setNote("");
    setHasDraft(false);
  };

  const changeStatus = async (s: string) => {
    const prev = status;
    setLessonStatus(s);
    const r = await setStatus("lessons", lessonId, s);
    if (!r.ok) {
      setLessonStatus(prev);
      toast({ title: "Status not changed", text: r.error, tone: "error" });
    } else toast({ title: s === "draft" ? "Hidden from students (draft)" : s === "coming_soon" ? "Marked as coming soon" : "Published to students" });
  };

  return (
    <div>
      <SetCrumb label={`${data.lesson.code} ${data.lesson.title_en}`} />

      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-accent-ink">Lesson {data.lesson.code}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{data.lesson.title_en || "Untitled"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <SaveIndicator state={saveState} savedAt={savedAt} />
            {hasDraft && <span className="rounded-full bg-note-soft px-2 py-0.5 text-xs font-semibold text-note">Unpublished changes</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Lesson status" value={status} onChange={(e) => void changeStatus(e.target.value)} className="!h-10 !w-auto !rounded-full">
            <option value="published">Published</option>
            <option value="draft">Draft (hidden)</option>
            <option value="coming_soon">Coming soon</option>
          </Select>
          {publicHref && (
            <a href={publicHref} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm text-muted ring-1 ring-line hover:text-ink">
              <ExternalLink className="size-4" aria-hidden /> Live
            </a>
          )}
          <Button icon={<History className="size-4" aria-hidden />} onClick={() => setHistoryOpen(true)}>
            History
          </Button>
          {hasDraft && (
            <Button variant="ghost" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => setDiscardOpen(true)}>
              Discard
            </Button>
          )}
          <Button variant="primary" icon={<Upload className="size-4" aria-hidden />} onClick={() => setPublishOpen(true)}>
            Publish
          </Button>
        </div>
      </div>

      {problems.length > 0 && (
        <details className="mb-4 rounded-2xl bg-tip-soft px-4 py-3 text-sm text-tip">
          <summary className="cursor-pointer font-semibold">{problems.length} thing(s) to fix before publishing</summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink/80">
            {problems.slice(0, 12).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}

      {/* tabs */}
      <div role="tablist" className="no-scrollbar mb-5 flex overflow-x-auto rounded-full bg-ink/[0.05] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex-1 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {tab === t.id && <motion.span layoutId="editor-tab" className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(29,42,44,0.14)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ type: "spring", stiffness: 420, damping: 36 }}>
          {tab === "details" && <DetailsTab data={data} patch={patch} />}
          {tab === "parts" && <PartsTab data={data} patch={patch} />}
          {tab === "terms" && <TermsTab data={data} patch={patch} />}
          {tab === "topics" && <TopicsTab data={data} patch={patch} />}
          {tab === "homework" && <HomeworkEditor items={data.homework ?? []} onChange={(h) => patch((d) => ((d.homework = h), d))} />}
          {tab === "practice" && <HomeworkEditor idPrefix="p" items={data.practice ?? []} onChange={(h) => patch((d) => ((d.practice = h), d))} />}
          {tab === "quiz" && <QuizTab data={data} patch={patch} focus={focusQuestion} />}
          {tab === "preview" && <PreviewTab data={data} />}
        </motion.div>
      </AnimatePresence>

      {/* publish */}
      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish this lesson"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} disabled={problems.length > 0} onClick={publish}>
              Publish now
            </Button>
          </>
        }
      >
        {problems.length > 0 ? (
          <ErrorState title={`Fix ${problems.length} problem(s) first`} text={problems[0]} />
        ) : (
          <>
            <p className="text-sm text-muted">Students will see these changes right away. The current live version is saved in History, so you can restore it.</p>
            <Field label="What changed? (optional)" className="mt-4">
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Fixed the Africa table" />
            </Field>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard unpublished changes"
        message="Your unpublished edits are deleted and the editor goes back to the live lesson."
        actionLabel="Discard changes"
        onConfirm={async () => {
          const r = await discardLessonDraft(lessonId);
          if (!r.ok) return toast({ title: "Not discarded", text: r.error, tone: "error" });
          first.current = true;
          setData(live);
          setHasDraft(false);
          setDiscardOpen(false);
          toast({ title: "Changes discarded" });
        }}
      />

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} lessonId={lessonId} code={data.lesson.code} />
    </div>
  );
}

function SaveIndicator({ state, savedAt }: { state: "saved" | "saving" | "dirty" | "error"; savedAt: string | null }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1.5"><span className="spinner !size-3.5" aria-hidden /> Saving draft…</span>;
  if (state === "dirty") return <span>Unsaved changes…</span>;
  if (state === "error") return <span className="text-bad">Draft not saved. Check your connection.</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Check className="size-3.5 text-good" aria-hidden />
      {savedAt ? (
        <>
          Draft saved <TimeAgo value={savedAt} />
        </>
      ) : (
        "Up to date"
      )}
    </span>
  );
}

type TabProps = { data: EditorData; patch: (f: (d: EditorData) => EditorData) => void };

/* ---------------- details ---------------- */

function DetailsTab({ data, patch }: TabProps) {
  const l = data.lesson;
  return (
    <Card>
      <CardTitle sub="Shown on the lesson page and the unit page">Lesson details</CardTitle>
      <div className="space-y-4">
        <BiField label="Title" en={l.title_en} am={l.title_am} onChange={(v) => patch((d) => ((d.lesson.title_en = v.en), (d.lesson.title_am = v.am), d))} />
        <BiField label="Summary" multiline en={l.summary_en} am={l.summary_am} onChange={(v) => patch((d) => ((d.lesson.summary_en = v.en), (d.lesson.summary_am = v.am), d))} />
        <BiField
          label={`Section title (${l.section_code})`}
          en={l.section_title_en}
          am={l.section_title_am}
          onChange={(v) => patch((d) => ((d.lesson.section_title_en = v.en), (d.lesson.section_title_am = v.am), d))}
        />
        <Field label="Minutes (shown as ~N min)" className="max-w-40">
          <Input type="number" min={1} max={240} value={l.minutes} onChange={(e) => patch((d) => ((d.lesson.minutes = Number(e.target.value)), d))} />
        </Field>
        <p className="text-xs text-faint">Code {l.code} and the URL ({l.slug}) are fixed. New lessons are added by Claude Code through migrations.</p>
      </div>
    </Card>
  );
}

/* ---------------- parts + blocks ---------------- */

function PartsTab({ data, patch }: TabProps) {
  const [open, setOpen] = useState<string | null>(data.sections[0]?.key ?? null);
  const addPart = () => {
    const key = uid();
    patch((d) => (d.sections.push({ id: null, key, title_en: "", title_am: "", icon: "book-open", blocks: [newBlock("paragraph")] }), d));
    setOpen(key);
  };
  return (
    <div>
      <p className="mb-3 text-sm text-muted">One part = one Learn-mode screen (one concept, max 8 blocks). Drag the handle to reorder. Wrap key terms in **double asterisks**.</p>
      <Reorder.Group axis="y" values={data.sections} onReorder={(v) => patch((d) => ((d.sections = v), d))} className="space-y-3">
        {data.sections.map((s, i) => (
          <PartCard
            key={s.key}
            s={s}
            index={i}
            open={open === s.key}
            onToggle={() => setOpen(open === s.key ? null : s.key)}
            lessonId={data.lesson.id}
            onChange={(ns) => patch((d) => ((d.sections[i] = ns), d))}
            onRemove={() => patch((d) => (d.sections.splice(i, 1), d))}
            canRemove={data.sections.length > 1}
          />
        ))}
      </Reorder.Group>
      <Button className="mt-3" icon={<Plus className="size-4" aria-hidden />} onClick={addPart} disabled={data.sections.length >= 30}>
        Add part
      </Button>
    </div>
  );
}

function PartCard({
  s,
  index,
  open,
  onToggle,
  onChange,
  onRemove,
  canRemove,
  lessonId,
}: {
  s: EditorSection;
  index: number;
  open: boolean;
  onToggle: () => void;
  onChange: (s: EditorSection) => void;
  onRemove: () => void;
  canRemove: boolean;
  lessonId: string;
}) {
  const controls = useDragControls();
  const [adding, setAdding] = useState<Block["type"]>("paragraph");
  const move = (j: number, dir: -1 | 1) => {
    const blocks = [...s.blocks];
    const [b] = blocks.splice(j, 1);
    blocks.splice(j + dir, 0, b!);
    onChange({ ...s, blocks });
  };
  return (
    <Reorder.Item value={s} dragListener={false} dragControls={controls} className="list-none">
      <Card className="!p-0">
        <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
          <button type="button" aria-label="Drag to reorder part" onPointerDown={(e) => controls.start(e)} className="grid size-8 cursor-grab touch-none place-items-center rounded-lg text-faint hover:bg-ink/[0.05]">
            <GripVertical className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="text-xs font-semibold text-faint tabular-nums">Part {index + 1}</span>
            <span className="truncate font-semibold text-ink">{s.title_en || "Untitled part"}</span>
            <span className="text-xs text-faint">{s.blocks.length} blocks</span>
            <ChevronDown className={`ml-auto size-4 text-faint transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 38 }} className="overflow-hidden">
              <div className="space-y-4 border-t border-line px-4 py-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <BiField label="Part title" en={s.title_en} am={s.title_am} onChange={(v) => onChange({ ...s, title_en: v.en, title_am: v.am })} />
                  <Field label="Icon">
                    <IconPicker value={s.icon} onChange={(icon) => onChange({ ...s, icon })} />
                  </Field>
                </div>
                {s.blocks.map((b, j) => (
                  <div key={j} className="rounded-2xl bg-paper/60 p-3 ring-1 ring-line sm:p-4">
                    <div className="mb-3 flex items-center gap-1">
                      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{BLOCK_LABEL[b.type]}</span>
                      <span className="ml-auto flex items-center">
                        <Button size="sm" variant="ghost" aria-label="Move block up" disabled={j === 0} onClick={() => move(j, -1)} icon={<ArrowUp className="size-3.5" aria-hidden />} />
                        <Button size="sm" variant="ghost" aria-label="Move block down" disabled={j === s.blocks.length - 1} onClick={() => move(j, 1)} icon={<ArrowDown className="size-3.5" aria-hidden />} />
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Duplicate block"
                          disabled={s.blocks.length >= 8}
                          onClick={() => onChange({ ...s, blocks: [...s.blocks.slice(0, j + 1), structuredClone(b), ...s.blocks.slice(j + 1)] })}
                          icon={<Copy className="size-3.5" aria-hidden />}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Remove block"
                          disabled={s.blocks.length <= 1}
                          onClick={() => onChange({ ...s, blocks: s.blocks.filter((_, k) => k !== j) })}
                          icon={<Trash2 className="size-3.5" aria-hidden />}
                        />
                      </span>
                    </div>
                    <BlockEditor block={b} lessonId={lessonId} onChange={(nb) => onChange({ ...s, blocks: s.blocks.map((x, k) => (k === j ? nb : x)) })} />
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-2">
                  <Select aria-label="Block type" value={adding} onChange={(e) => setAdding(e.target.value as Block["type"])} className="!h-9 !w-auto !rounded-full">
                    {BLOCK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {BLOCK_LABEL[t]}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} disabled={s.blocks.length >= 8} onClick={() => onChange({ ...s, blocks: [...s.blocks, newBlock(adding)] })}>
                    Add block
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto !text-bad" disabled={!canRemove} onClick={onRemove} icon={<Trash2 className="size-3.5" aria-hidden />}>
                    Remove part
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </Reorder.Item>
  );
}

/* ---------------- key terms + main topics ---------------- */

function TermsTab({ data, patch }: TabProps) {
  return (
    <Card>
      <CardTitle sub="A term gets a tap/hover popover wherever it appears as **term** or as a points title.">Key terms</CardTitle>
      <div className="space-y-4">
        {data.glossary.map((g, i) => (
          <div key={i} className="rounded-2xl bg-paper/60 p-3 ring-1 ring-line">
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="ghost" aria-label={`Remove term ${i + 1}`} onClick={() => patch((d) => (d.glossary.splice(i, 1), d))} icon={<Trash2 className="size-3.5" aria-hidden />} />
            </div>
            <div className="space-y-3">
              <BiField label="Term" en={g.term.en} am={g.term.am} onChange={(v) => patch((d) => ((d.glossary[i]!.term = v), d))} />
              <BiField label="Definition (one sentence)" multiline rows={2} en={g.definition.en} am={g.definition.am} onChange={(v) => patch((d) => ((d.glossary[i]!.definition = v), d))} />
            </div>
          </div>
        ))}
        <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => patch((d) => (d.glossary.push({ term: { en: "", am: "" }, definition: { en: "", am: "" } }), d))}>
          Add key term
        </Button>
      </div>
    </Card>
  );
}

function TopicsTab({ data, patch }: TabProps) {
  return (
    <div className="space-y-3">
      {data.main_topics.map((t, i) => (
        <Card key={i}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-faint">Topic {i + 1}</span>
            <Button size="sm" variant="ghost" aria-label={`Remove topic ${i + 1}`} onClick={() => patch((d) => (d.main_topics.splice(i, 1), d))} icon={<Trash2 className="size-3.5" aria-hidden />} />
          </div>
          <div className="space-y-3">
            <BiField label="Title" en={t.title.en} am={t.title.am} onChange={(v) => patch((d) => ((d.main_topics[i]!.title = v), d))} />
            {t.points.map((p, j) => (
              <div key={j} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <BiField label={`Point ${j + 1}`} multiline rows={2} en={p.en} am={p.am} onChange={(v) => patch((d) => ((d.main_topics[i]!.points[j] = v), d))} />
                </div>
                <Button size="sm" variant="ghost" className="mt-6" aria-label={`Remove point ${j + 1}`} disabled={t.points.length <= 1} onClick={() => patch((d) => (d.main_topics[i]!.points.splice(j, 1), d))} icon={<Trash2 className="size-3.5" aria-hidden />} />
              </div>
            ))}
            <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => patch((d) => (d.main_topics[i]!.points.push({ en: "", am: "" }), d))}>
              Add point
            </Button>
          </div>
        </Card>
      ))}
      <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => patch((d) => (d.main_topics.push({ title: { en: "", am: "" }, points: [{ en: "", am: "" }] }), d))}>
        Add main topic
      </Button>
    </div>
  );
}

/* ---------------- quiz ---------------- */

function QuizTab({ data, patch, focus }: TabProps & { focus?: string }) {
  const quiz = data.quiz;
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`q-${focus}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  if (!quiz) {
    return (
      <Card>
        <p className="text-sm text-muted">This lesson has no quiz yet.</p>
        <Button
          className="mt-3"
          variant="primary"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => patch((d) => ((d.quiz = { id: null, title_en: `Quiz: ${d.lesson.title_en}`, title_am: `ፈተና፦ ${d.lesson.title_am}`, description_en: "", description_am: "", questions: [] }), d))}
        >
          Create quiz
        </Button>
      </Card>
    );
  }
  const addQ = () =>
    patch(
      (d) => (
        d.quiz!.questions.push({
          id: null,
          key: uid(),
          question_en: "",
          question_am: "",
          options_en: ["", "", "", ""],
          options_am: ["", "", "", ""],
          correct_index: 0,
          explanation_en: "",
          explanation_am: "",
        }),
        d
      ),
    );
  return (
    <div className="space-y-3">
      <Card>
        <div className="space-y-3">
          <BiField label="Quiz title" en={quiz.title_en} am={quiz.title_am} onChange={(v) => patch((d) => ((d.quiz!.title_en = v.en), (d.quiz!.title_am = v.am), d))} />
          <BiField label="Description" en={quiz.description_en} am={quiz.description_am} onChange={(v) => patch((d) => ((d.quiz!.description_en = v.en), (d.quiz!.description_am = v.am), d))} />
        </div>
      </Card>
      <Reorder.Group axis="y" values={quiz.questions} onReorder={(v) => patch((d) => ((d.quiz!.questions = v), d))} className="space-y-3">
        {quiz.questions.map((q, i) => (
          <QuestionCard
            key={q.key}
            q={q}
            index={i}
            highlight={!!focus && q.id === focus}
            onChange={(nq) => patch((d) => ((d.quiz!.questions[i] = nq), d))}
            onRemove={() => patch((d) => (d.quiz!.questions.splice(i, 1), d))}
          />
        ))}
      </Reorder.Group>
      <Button icon={<Plus className="size-4" aria-hidden />} onClick={addQ} disabled={quiz.questions.length >= 40}>
        Add question
      </Button>
    </div>
  );
}

function QuestionCard({ q, index, highlight, onChange, onRemove }: { q: EditorQuestion; index: number; highlight: boolean; onChange: (q: EditorQuestion) => void; onRemove: () => void }) {
  const controls = useDragControls();
  const setOption = (k: number, v: { en: string; am: string }) =>
    onChange({ ...q, options_en: q.options_en.map((o, i) => (i === k ? v.en : o)), options_am: q.options_am.map((o, i) => (i === k ? v.am : o)) });
  return (
    <Reorder.Item value={q} dragListener={false} dragControls={controls} className="list-none" id={q.id ? `q-${q.id}` : undefined}>
      <Card className={highlight ? "!ring-2 !ring-tip" : ""}>
        <div className="mb-3 flex items-center gap-2">
          <button type="button" aria-label="Drag to reorder question" onPointerDown={(e) => controls.start(e)} className="grid size-8 cursor-grab touch-none place-items-center rounded-lg text-faint hover:bg-ink/[0.05]">
            <GripVertical className="size-4" aria-hidden />
          </button>
          <span className="text-sm font-semibold text-ink">Question {index + 1}</span>
          <Button size="sm" variant="ghost" className="ml-auto" aria-label={`Delete question ${index + 1}`} onClick={onRemove} icon={<Trash2 className="size-3.5" aria-hidden />} />
        </div>
        <div className="space-y-3">
          <Field label="Answer type">
            <Select
              value={q.kind ?? "choice"}
              onChange={(e) => {
                const kind = e.target.value as NonNullable<EditorQuestion["kind"]>;
                onChange({
                  ...q,
                  kind,
                  answer: kind === "number" ? { value: 0 } : kind === "set" ? { value: [] } : kind === "venn" ? { venn: { sets: 2, labels: ["A", "B"] }, regions: [] } : null,
                  options_en: kind === "choice" && q.options_en.length < 2 ? ["", "", "", ""] : q.options_en,
                  options_am: kind === "choice" && q.options_am.length < 2 ? ["", "", "", ""] : q.options_am,
                });
              }}
            >
              <option value="choice">Multiple choice</option>
              <option value="number">Number</option>
              <option value="set">Set, e.g. {"{-1, 0, 1}"}</option>
              <option value="venn">Shade the Venn diagram</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--accent)]"
              checked={!!q.needs_calculation}
              onChange={(e) => onChange({ ...q, needs_calculation: e.target.checked })}
            />
            Show &quot;Calculation paper&quot; and &quot;Calculator&quot; (only if this question needs calculating or drawing)
          </label>
          <BiField label="Question (math in $…$)" multiline rows={2} en={q.question_en} am={q.question_am} onChange={(v) => onChange({ ...q, question_en: v.en, question_am: v.am })} />
          {q.kind === "number" && (
            <Field label="Correct number">
              <Input type="number" step="any" value={Number(q.answer?.value ?? 0)} onChange={(e) => onChange({ ...q, answer: { value: Number(e.target.value) } })} />
            </Field>
          )}
          {q.kind === "set" && <SetValueInput value={Array.isArray(q.answer?.value) ? q.answer.value : []} onChange={(value) => onChange({ ...q, answer: { value } })} />}
          {q.kind === "venn" && q.answer?.venn && (
            <>
              <VennDataEditor venn={q.answer.venn} withElements={false} onChange={(venn) => onChange({ ...q, answer: { venn, regions: venn.sets === q.answer?.venn?.sets ? (q.answer?.regions ?? []) : [] } })} />
              <RegionsInput venn={q.answer.venn} regions={q.answer.regions ?? []} onChange={(regions) => onChange({ ...q, answer: { ...q.answer, regions } })} />
            </>
          )}
          {(q.kind ?? "choice") === "choice" && (
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink/80">Options (choose the correct one)</legend>
            <div className="space-y-2">
              {q.options_en.map((_, k) => (
                <div key={k} className="flex items-start gap-2">
                  <label className="mt-2.5 flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted">
                    <input type="radio" name={`correct-${q.key}`} className="accent-[var(--accent)]" checked={q.correct_index === k} onChange={() => onChange({ ...q, correct_index: k })} />
                    {String.fromCharCode(65 + k)}
                  </label>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <Input aria-label={`Option ${k + 1} (English)`} value={q.options_en[k]} onChange={(e) => setOption(k, { en: e.target.value, am: q.options_am[k] ?? "" })} className={q.correct_index === k ? "!ring-good/50" : ""} />
                    <Input aria-label={`Option ${k + 1} (Amharic)`} value={q.options_am[k] ?? ""} onChange={(e) => setOption(k, { en: q.options_en[k] ?? "", am: e.target.value })} className="am" />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1"
                    aria-label={`Remove option ${k + 1}`}
                    disabled={q.options_en.length <= 2}
                    onClick={() =>
                      onChange({
                        ...q,
                        options_en: q.options_en.filter((_, i) => i !== k),
                        options_am: q.options_am.filter((_, i) => i !== k),
                        correct_index: q.correct_index === k ? 0 : q.correct_index > k ? q.correct_index - 1 : q.correct_index,
                      })
                    }
                    icon={<Trash2 className="size-3.5" aria-hidden />}
                  />
                </div>
              ))}
            </div>
            {q.options_en.length < 6 && (
              <Button size="sm" className="mt-2" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => onChange({ ...q, options_en: [...q.options_en, ""], options_am: [...q.options_am, ""] })}>
                Add option
              </Button>
            )}
          </fieldset>
          )}
          <BiField label="Explanation (why)" multiline rows={2} en={q.explanation_en} am={q.explanation_am} onChange={(v) => onChange({ ...q, explanation_en: v.en, explanation_am: v.am })} />
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-ink/80">Step-by-step explanation (shown after answering)</p>
            {(q.steps ?? []).map((s, k, all) => (
              <div key={k} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <BiField label={`Step ${k + 1}`} en={s.text.en} am={s.text.am} onChange={(text) => onChange({ ...q, steps: all.map((x, j) => (j === k ? { text } : x)) })} />
                </div>
                <Button size="sm" variant="ghost" className="mt-6" aria-label={`Remove step ${k + 1}`} onClick={() => onChange({ ...q, steps: all.filter((_, j) => j !== k) })} icon={<Trash2 className="size-3.5" aria-hidden />} />
              </div>
            ))}
            {(q.steps?.length ?? 0) < 10 && (
              <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => onChange({ ...q, steps: [...(q.steps ?? []), { text: { en: "", am: "" } }] })}>
                Add step
              </Button>
            )}
          </div>
        </div>
      </Card>
    </Reorder.Item>
  );
}

/* ---------------- live preview ---------------- */

function PreviewTab({ data }: { data: EditorData }) {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [mode, setMode] = useState<"learn" | "all" | "topics">("learn");
  const [lang, setLang] = useState<Lang>("en");
  const sections: LessonSection[] = data.sections.map((s, i) => ({ id: s.key, sort_order: i + 1, title_en: s.title_en, title_am: s.title_am, icon: s.icon, blocks: s.blocks }));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full bg-ink/[0.05] p-1">
          {(["phone", "desktop"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${device === d ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>
              {d === "phone" ? <Smartphone className="size-3.5" aria-hidden /> : <Monitor className="size-3.5" aria-hidden />} {d === "phone" ? "Phone" : "Desktop"}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-full bg-ink/[0.05] p-1">
          {(
            [
              ["learn", "Learn"],
              ["all", "Read all"],
              ["topics", "Main topics"],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${mode === m ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>
              {label}
            </button>
          ))}
        </div>
        <LanguageToggle lang={lang} onChange={setLang} />
        <span className="text-xs text-faint">Preview of your unpublished edits</span>
      </div>
      <div className={device === "phone" ? "mx-auto w-[390px] max-w-full" : ""}>
        <div className={`overflow-hidden bg-paper ring-1 ring-line ${device === "phone" ? "h-[720px] overflow-y-auto rounded-[2.2rem] px-4 py-6 ring-[6px] ring-ink/85" : "rounded-3xl px-6 py-8"}`}>
          <GlossaryProvider entries={data.glossary} lang={lang}>
            {mode === "learn" && (
              <LearnMode
                key={sections.length}
                lessonId={`preview-${data.lesson.id}`}
                lessonTitle={data.lesson.title_en}
                sections={sections}
                lang={lang}
                locale="en"
                hasQuiz={!!data.quiz}
                exitHref="#"
                onStartQuiz={() => {}}
              />
            )}
            {mode === "all" && <ReadAll sections={sections} lang={lang} locale="en" onPartChange={() => {}} />}
            {mode === "topics" && <MainTopics topics={data.main_topics} lang={lang} locale="en" />}
          </GlossaryProvider>
        </div>
      </div>
    </div>
  );
}

/* ---------------- version history ---------------- */

function HistoryModal({ open, onClose, lessonId, code }: { open: boolean; onClose: () => void; lessonId: string; code: string }) {
  const toast = useToast();
  const [items, setItems] = useState<{ id: number; note: string | null; created_at: string; by: string | null }[] | null>(null);
  const [restore, setRestore] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);
    void lessonVersions(lessonId).then((r) => setItems(r.ok ? r.data : []));
  }, [open, lessonId]);

  return (
    <>
      <Modal open={open && restore === null} onClose={onClose} title="Version history">
        <p className="mb-3 text-sm text-muted">Each publish saves the version that was live before it. Restoring makes that version live again (and saves the current one first).</p>
        {items === null && <div className="flex justify-center py-6"><span className="spinner" aria-hidden /></div>}
        {items?.length === 0 && <p className="text-sm text-muted">No earlier versions yet.</p>}
        <ul className="divide-y divide-line">
          {items?.map((v) => (
            <li key={v.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">#{v.id} · {v.note || "Before edit"}</span>
                <span className="text-xs text-faint">
                  {fmtDate(v.created_at, true)}
                  {v.by ? ` · @${v.by}` : ""}
                </span>
              </span>
              <Button size="sm" onClick={() => setRestore(v.id)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      </Modal>
      <ConfirmDialog
        open={restore !== null}
        onClose={() => setRestore(null)}
        title={`Restore version #${restore}`}
        message="This version becomes the live lesson. The current live version is saved in History first."
        actionLabel="Restore"
        danger={false}
        onConfirm={async () => {
          const r = await restoreLessonVersion(lessonId, restore!);
          if (!r.ok) return toast({ title: "Not restored", text: r.error, tone: "error" });
          toast({ title: "Version restored" });
          setRestore(null);
          onClose();
          window.location.reload();
        }}
      />
    </>
  );
}
