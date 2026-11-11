"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { AnswerSpec, Bi, HomeworkItem, VennBlock, VennData, WorkedBlock, WorkedStep } from "@/lib/types";
import { BiField, Button, Field, Input, Select } from "@/components/admin/ui";
import { REGIONS, evalVenn } from "@/lib/math/venn";
import { canonicalSet, parseSetAnswer } from "@/lib/math/sets";
import { VennDiagram } from "@/components/math/venn-diagram";
import { MathText } from "@/components/math/tex";

const bi = (en = "", am = ""): Bi => ({ en, am });
const NAMES = ["A", "B", "C"];

/** Evaluate a shade expression for the live preview; returns regions or an error message. */
function tryShade(expr: string | undefined, venn: VennData): { regions: string[]; error?: string } {
  if (!expr?.trim()) return { regions: [] };
  try {
    return { regions: evalVenn(expr, venn.sets, venn.labels ?? NAMES.slice(0, venn.sets)) };
  } catch (e) {
    return { regions: [], error: e instanceof Error ? e.message : "Invalid expression" };
  }
}

const MATH_HINT = "Math in $…$, e.g. $A \\cup B$, $x \\in \\mathbb{R}$, $A'$, $\\{1, 2\\}$, $\\emptyset$.";

/** Small list helper: move / remove buttons. */
function RowTools({ i, n, onMove, onRemove, min = 0, label }: { i: number; n: number; onMove: (to: number) => void; onRemove: () => void; min?: number; label: string }) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button size="sm" variant="ghost" aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => onMove(i - 1)} icon={<ArrowUp className="size-3.5" aria-hidden />} />
      <Button size="sm" variant="ghost" aria-label={`Move ${label} down`} disabled={i === n - 1} onClick={() => onMove(i + 1)} icon={<ArrowDown className="size-3.5" aria-hidden />} />
      <Button size="sm" variant="ghost" aria-label={`Remove ${label}`} disabled={n <= min} onClick={onRemove} icon={<Trash2 className="size-3.5" aria-hidden />} />
    </div>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x!);
  return a;
}

/* ------------------------------------------------------------------ Venn data */

export function VennDataEditor({ venn, onChange, withElements = true }: { venn: VennData; onChange: (v: VennData) => void; withElements?: boolean }) {
  const labels = venn.labels ?? NAMES.slice(0, venn.sets);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field label="Sets">
          <Select
            value={venn.sets}
            onChange={(e) => {
              const sets = Number(e.target.value) as 2 | 3;
              onChange({ ...venn, sets, labels: NAMES.slice(0, sets).map((n, i) => labels[i] ?? n), elements: undefined });
            }}
          >
            <option value={2}>2 sets</option>
            <option value={3}>3 sets</option>
          </Select>
        </Field>
        <Field label="Circle labels" hint="Usually A, B, C. Use other letters if the question does (e.g. F, M).">
          <div className="flex gap-2">
            {labels.map((l, i) => (
              <Input key={i} aria-label={`Label ${i + 1}`} value={l} maxLength={3} className="w-20" onChange={(e) => onChange({ ...venn, labels: labels.map((x, k) => (k === i ? e.target.value : x)) })} />
            ))}
          </div>
        </Field>
      </div>
      {withElements && (
        <Field label="Elements in each region (optional, comma separated)" hint='Region "A" = only A, "AB" = A and B only, "none" = outside every circle.'>
          <div className="grid gap-2 sm:grid-cols-2">
            {REGIONS[venn.sets].map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <span className="w-12 shrink-0 font-mono text-xs text-muted">{r}</span>
                <Input
                  aria-label={`Elements in region ${r}`}
                  value={(venn.elements?.[r] ?? []).join(", ")}
                  onChange={(e) => {
                    const els = e.target.value.split(",").map((x) => x.trim()).filter(Boolean);
                    const elements = { ...(venn.elements ?? {}), [r]: els };
                    if (!els.length) delete elements[r];
                    onChange({ ...venn, elements: Object.keys(elements).length ? elements : undefined });
                  }}
                />
              </label>
            ))}
          </div>
        </Field>
      )}
    </div>
  );
}

function ShadeInput({ value, venn, onChange, label = "Shade (set expression)" }: { value: string; venn: VennData; onChange: (v: string) => void; label?: string }) {
  const r = tryShade(value, venn);
  return (
    <Field label={label} hint={r.error ? <span className="text-bad">{r.error}</span> : "Use ∪ ∩ ∖ (or \\) Δ ′ ( ) U ∅, e.g. A∩B∖C or (A∪B)′."}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. A∖(B∪C)" />
    </Field>
  );
}

/* ------------------------------------------------------------------ Venn block */

export function VennBlockEditor({ block: b, onChange }: { block: VennBlock; onChange: (b: VennBlock) => void }) {
  const preview = tryShade(b.shade, b.venn);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <VennDataEditor venn={b.venn} onChange={(venn) => onChange({ ...b, venn })} />
        <ShadeInput label="Shaded at the start (optional)" value={b.shade ?? ""} venn={b.venn} onChange={(v) => onChange({ ...b, shade: v || undefined })} />
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">&quot;Show me&quot; steps (optional)</p>
          {(b.steps ?? []).map((s, i, all) => (
            <div key={i} className="rounded-2xl bg-paper p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
                <RowTools i={i} n={all.length} label={`step ${i + 1}`} onMove={(to) => onChange({ ...b, steps: move(all, i, to) })} onRemove={() => onChange({ ...b, steps: all.filter((_, k) => k !== i) })} />
              </div>
              <ShadeInput value={s.shade} venn={b.venn} onChange={(shade) => onChange({ ...b, steps: all.map((x, k) => (k === i ? { ...x, shade } : x)) })} />
              <div className="mt-2">
                <BiField label="Caption" en={s.text.en} am={s.text.am} onChange={(text) => onChange({ ...b, steps: all.map((x, k) => (k === i ? { ...x, text } : x)) })} />
              </div>
            </div>
          ))}
          {(b.steps?.length ?? 0) < 8 && (
            <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => onChange({ ...b, steps: [...(b.steps ?? []), { shade: "", text: bi() }] })}>
              Add step
            </Button>
          )}
        </div>
        <BiField label="Caption (optional)" en={b.caption?.en ?? ""} am={b.caption?.am ?? ""} onChange={(v) => onChange({ ...b, caption: v.en || v.am ? v : undefined })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-[var(--accent)]" checked={b.showElements ?? !!b.venn.elements} onChange={(e) => onChange({ ...b, showElements: e.target.checked })} /> Show the elements in the regions
        </label>
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-1 text-xs font-medium text-muted">Preview</p>
        <div className="rounded-2xl bg-surface p-2 ring-1 ring-line">
          <VennDiagram venn={b.venn} shaded={preview.regions} showElements={b.showElements ?? !!b.venn.elements} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ worked example steps */

export function StepsEditor({ steps, onChange, venn, min = 1 }: { steps: WorkedStep[]; onChange: (s: WorkedStep[]) => void; venn?: VennData; min?: number }) {
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i} className="rounded-2xl bg-paper p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
            <RowTools i={i} n={steps.length} min={min} label={`step ${i + 1}`} onMove={(to) => onChange(move(steps, i, to))} onRemove={() => onChange(steps.filter((_, k) => k !== i))} />
          </div>
          <div className="space-y-2">
            <BiField label="Working (one short line)" en={s.text.en} am={s.text.am} onChange={(text) => onChange(steps.map((x, k) => (k === i ? { ...x, text } : x)))} />
            <BiField label='"Why?" (like a teacher talking, optional)' multiline rows={2} en={s.why?.en ?? ""} am={s.why?.am ?? ""} onChange={(why) => onChange(steps.map((x, k) => (k === i ? { ...x, why: why.en || why.am ? why : undefined } : x)))} />
            {venn && <ShadeInput label="Venn beside it shades (optional)" value={s.shade ?? ""} venn={venn} onChange={(shade) => onChange(steps.map((x, k) => (k === i ? { ...x, shade: shade || undefined } : x)))} />}
          </div>
        </div>
      ))}
      {steps.length < 14 && (
        <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => onChange([...steps, { text: bi() }])}>
          Add step
        </Button>
      )}
    </div>
  );
}

export function WorkedBlockEditor({ block: b, onChange }: { block: WorkedBlock; onChange: (b: WorkedBlock) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-faint">{MATH_HINT}</p>
      <BiField label="Title" en={b.title.en} am={b.title.am} onChange={(title) => onChange({ ...b, title })} />
      <BiField label="Problem" multiline rows={2} en={b.problem.en} am={b.problem.am} onChange={(problem) => onChange({ ...b, problem })} />
      <StepsEditor steps={b.steps} venn={b.venn} onChange={(steps) => onChange({ ...b, steps })} />
      <BiField label="Final answer (highlighted)" en={b.answer.en} am={b.answer.am} onChange={(answer) => onChange({ ...b, answer })} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-[var(--accent)]"
          checked={!!b.venn}
          onChange={(e) => onChange({ ...b, venn: e.target.checked ? { sets: 2, labels: ["A", "B"] } : undefined })}
        />
        Venn diagram beside the working (follows each step&apos;s shade)
      </label>
      {b.venn && <VennDataEditor venn={b.venn} onChange={(venn) => onChange({ ...b, venn })} />}
    </div>
  );
}

/* ------------------------------------------------------------------ answer spec (homework) */

export function newSpec(kind: AnswerSpec["kind"]): AnswerSpec {
  if (kind === "choice") return { kind, options: [bi(), bi(), bi(), bi()], correct: 0 };
  if (kind === "number") return { kind, value: 0 };
  if (kind === "set") return { kind, value: [] };
  return { kind, venn: { sets: 2, labels: ["A", "B"] }, regions: [] };
}

/** Set answer typed as text ("{-1, 0, 1}" or "∅") ⇄ canonical list. */
export function SetValueInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const text = value.length ? `{${value.join(", ")}}` : "∅";
  return (
    <Field label="Correct set" hint="Order, spaces and duplicates don't matter. ∅ or { } for the empty set.">
      <Input
        key={text}
        defaultValue={text}
        onBlur={(e) => {
          const p = parseSetAnswer(e.target.value);
          if (p.ok) onChange(canonicalSet(p.elements));
        }}
      />
    </Field>
  );
}

/** Pick the shaded regions by tapping the diagram. */
export function RegionsInput({ venn, regions, onChange, label = "Correct shading (tap regions)" }: { venn: VennData; regions: string[]; onChange: (r: string[]) => void; label?: string }) {
  return (
    <Field label={label} hint={regions.length ? `Shaded: ${regions.join(", ")}` : "Nothing shaded yet."}>
      <div className="max-w-[300px] rounded-2xl bg-surface p-2 ring-1 ring-line">
        <VennDiagram venn={venn} shaded={regions} mode="answer" onRegion={(r) => onChange(regions.includes(r) ? regions.filter((x) => x !== r) : [...regions, r].sort())} />
      </div>
    </Field>
  );
}

export function AnswerSpecEditor({ spec, onChange }: { spec: AnswerSpec; onChange: (s: AnswerSpec) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Answer type">
        <Select value={spec.kind} onChange={(e) => onChange(newSpec(e.target.value as AnswerSpec["kind"]))}>
          <option value="choice">Multiple choice</option>
          <option value="number">Number</option>
          <option value="set">Set, e.g. {"{-1, 0, 1}"}</option>
          <option value="venn">Shade the Venn diagram</option>
        </Select>
      </Field>
      {spec.kind === "number" && (
        <Field label="Correct number">
          <Input type="number" step="any" value={Number.isFinite(spec.value) ? spec.value : 0} onChange={(e) => onChange({ ...spec, value: Number(e.target.value) })} />
        </Field>
      )}
      {spec.kind === "set" && <SetValueInput value={spec.value} onChange={(value) => onChange({ ...spec, value })} />}
      {spec.kind === "venn" && (
        <>
          <VennDataEditor venn={spec.venn} withElements={false} onChange={(venn) => onChange({ ...spec, venn, regions: venn.sets === spec.venn.sets ? spec.regions : [] })} />
          <RegionsInput venn={spec.venn} regions={spec.regions} onChange={(regions) => onChange({ ...spec, regions })} />
        </>
      )}
      {spec.kind === "choice" && (
        <div className="space-y-2">
          {spec.options.map((o, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                type="radio"
                name={`correct-${spec.options.length}-${o.en}`}
                aria-label={`Option ${i + 1} is correct`}
                className="mt-8 accent-[var(--good)]"
                checked={spec.correct === i}
                onChange={() => onChange({ ...spec, correct: i })}
              />
              <div className="min-w-0 flex-1">
                <BiField label={`Option ${String.fromCharCode(65 + i)}`} en={o.en} am={o.am} onChange={(v) => onChange({ ...spec, options: spec.options.map((x, k) => (k === i ? v : x)) })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ homework */

export function newHomeworkItem(n: number, prefix = "hw"): HomeworkItem {
  return { id: `${prefix}${n}`, question: bi(), tip: bi(), hints: [bi(), bi()], answers: [], solution: { steps: [{ text: bi() }], answer: bi() } };
}

export function HomeworkEditor({ items, onChange, idPrefix = "hw" }: { items: HomeworkItem[]; onChange: (h: HomeworkItem[]) => void; idPrefix?: string }) {
  const ids = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const nextId = () => {
    let n = items.length + 1;
    while (ids.has(`${idPrefix}${n}`)) n++;
    return n;
  };
  const set = (i: number, patch: Partial<HomeworkItem>) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Textbook-style exercises. Students see: question → Tip → &quot;I&apos;m stuck&quot; (hints one by one) → full step-by-step solution on paper. {MATH_HINT}
      </p>
      {items.map((it, i) => (
        <details key={it.id} className="group rounded-2xl bg-surface ring-1 ring-line" open={items.length <= 2}>
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{it.question.en ? <MathText text={it.question.en} /> : <em className="text-faint">New exercise</em>}</span>
            <span onClick={(e) => e.preventDefault()}>
              <RowTools i={i} n={items.length} label={`exercise ${i + 1}`} onMove={(to) => onChange(move(items, i, to))} onRemove={() => onChange(items.filter((_, k) => k !== i))} />
            </span>
          </summary>
          <div className="space-y-4 border-t border-line p-4">
            <BiField label="Question" multiline rows={2} en={it.question.en} am={it.question.am} onChange={(question) => set(i, { question })} />
            <BiField label="Tip" multiline rows={2} en={it.tip.en} am={it.tip.am} onChange={(tip) => set(i, { tip })} />
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Hints (shown one at a time)</p>
              {it.hints.map((h, j) => (
                <div key={j} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <BiField label={`Hint ${j + 1}`} multiline rows={2} en={h.en} am={h.am} onChange={(v) => set(i, { hints: it.hints.map((x, k) => (k === j ? v : x)) })} />
                  </div>
                  <Button size="sm" variant="ghost" className="mt-6" aria-label={`Remove hint ${j + 1}`} onClick={() => set(i, { hints: it.hints.filter((_, k) => k !== j) })} icon={<Trash2 className="size-3.5" aria-hidden />} />
                </div>
              ))}
              {it.hints.length < 4 && (
                <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => set(i, { hints: [...it.hints, bi()] })}>
                  Add hint
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Answer boxes (optional: students can check their answer)</p>
              {it.answers.map((a, j) => (
                <div key={j} className="rounded-2xl bg-paper p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">Answer box {j + 1}</span>
                    <RowTools i={j} n={it.answers.length} label={`answer box ${j + 1}`} onMove={(to) => set(i, { answers: move(it.answers, j, to) })} onRemove={() => set(i, { answers: it.answers.filter((_, k) => k !== j) })} />
                  </div>
                  <div className="space-y-3">
                    <BiField label="Label, e.g. (a) $A \cup B$" en={a.label.en} am={a.label.am} onChange={(label) => set(i, { answers: it.answers.map((x, k) => (k === j ? { ...x, label } : x)) })} />
                    <AnswerSpecEditor spec={a.spec} onChange={(spec) => set(i, { answers: it.answers.map((x, k) => (k === j ? { ...x, spec } : x)) })} />
                  </div>
                </div>
              ))}
              {it.answers.length < 8 && (
                <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => set(i, { answers: [...it.answers, { label: bi(), spec: newSpec("set") }] })}>
                  Add answer box
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Full solution (paper mode)</p>
              <StepsEditor steps={it.solution.steps} venn={it.solution.venn} onChange={(steps) => set(i, { solution: { ...it.solution, steps } })} />
              <BiField label="Final answer" en={it.solution.answer.en} am={it.solution.answer.am} onChange={(answer) => set(i, { solution: { ...it.solution, answer } })} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={!!it.solution.venn}
                  onChange={(e) => set(i, { solution: { ...it.solution, venn: e.target.checked ? { sets: 2, labels: ["A", "B"] } : undefined } })}
                />
                Venn diagram beside the solution
              </label>
              {it.solution.venn && <VennDataEditor venn={it.solution.venn} onChange={(venn) => set(i, { solution: { ...it.solution, venn } })} />}
            </div>
          </div>
        </details>
      ))}
      {items.length < 30 && (
        <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => onChange([...items, newHomeworkItem(nextId(), idPrefix)])}>
          Add exercise
        </Button>
      )}
    </div>
  );
}
