"use client";

import { useState } from "react";
import { ImageUp, Plus, Trash2 } from "lucide-react";
import type { Bi, Block } from "@/lib/types";
import { BiField, Button, Field, Input, Select } from "@/components/admin/ui";
import { SectionIcon } from "@/components/study/section-icon";
import { ICON_NAMES } from "@/lib/admin/lesson-validate";
import { uploadImage } from "@/components/admin/upload";
import { useToast } from "@/components/admin/toast";

const bi = (en = "", am = ""): Bi => ({ en, am });

export const BLOCK_LABEL: Record<Block["type"], string> = {
  paragraph: "Paragraph",
  keypoint: "Key point / definition",
  points: "Points with icons",
  list: "List",
  table: "Table",
  example: "Example",
  tip: "Memory tip",
  terms: "Key-word chips",
  heading: "Sub-heading",
  image: "Image",
};

/** A new empty block of a type. */
export function newBlock(type: Block["type"]): Block {
  switch (type) {
    case "paragraph":
    case "heading":
      return { type, text: bi() };
    case "keypoint":
      return { type, variant: "definition", title: bi(), text: bi() };
    case "points":
      return { type, items: [{ icon: "lightbulb", title: bi(), text: bi() }, { icon: "lightbulb", title: bi(), text: bi() }] };
    case "list":
      return { type, items: [bi()] };
    case "table":
      return { type, headers: [bi(), bi()], rows: [[bi(), bi()]] };
    case "example":
      return { type, title: bi("Example", "ምሳሌ"), text: bi() };
    case "tip":
      return { type, title: bi("Memory trick", "የማስታወሻ ዘዴ"), text: bi() };
    case "terms":
      return { type, title: bi("Key words", "ቁልፍ ቃላት"), items: [bi()] };
    case "image":
      return { type, src: "", width: 900, height: 600, alt: bi(), caption: bi(), credit: "", creditUrl: "" };
  }
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        <SectionIcon name={value} />
      </span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Icon">
        {ICON_NAMES.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
    </div>
  );
}

function BiList({ items, onChange, label, max = 8, multiline }: { items: Bi[]; onChange: (v: Bi[]) => void; label: string; max?: number; multiline?: boolean }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <BiField label={`${label} ${i + 1}`} multiline={multiline} rows={2} en={it.en} am={it.am} onChange={(v) => onChange(items.map((x, k) => (k === i ? v : x)))} />
          </div>
          <Button size="sm" variant="ghost" className="mt-6" aria-label={`Remove ${label} ${i + 1}`} disabled={items.length <= 1} onClick={() => onChange(items.filter((_, k) => k !== i))} icon={<Trash2 className="size-3.5" aria-hidden />} />
        </div>
      ))}
      {items.length < max && (
        <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => onChange([...items, bi()])}>
          Add {label.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

/** Form for one note block. Every text has English + Amharic side by side. `**word**` marks a key term. */
export function BlockEditor({ block, onChange, lessonId }: { block: Block; onChange: (b: Block) => void; lessonId: string }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const b = block;

  switch (b.type) {
    case "heading":
      return <BiField label="Heading" en={b.text.en} am={b.text.am} onChange={(v) => onChange({ ...b, text: v })} />;
    case "paragraph":
      return <BiField label="Text (1–2 short sentences)" multiline en={b.text.en} am={b.text.am} onChange={(v) => onChange({ ...b, text: v })} />;
    case "keypoint":
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Style">
              <Select value={b.variant ?? "definition"} onChange={(e) => onChange({ ...b, variant: e.target.value as "definition" | "important" | "note" })}>
                <option value="definition">Definition</option>
                <option value="important">Important</option>
                <option value="note">Textbook note</option>
              </Select>
            </Field>
            <Field label="Icon (optional)">
              <Select value={b.icon ?? ""} onChange={(e) => onChange({ ...b, icon: e.target.value || undefined })}>
                <option value="">Default</option>
                {ICON_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <BiField label="Title" en={b.title.en} am={b.title.am} onChange={(v) => onChange({ ...b, title: v })} />
          <BiField label="Text" multiline en={b.text.en} am={b.text.am} onChange={(v) => onChange({ ...b, text: v })} />
        </div>
      );
    case "example":
    case "tip":
      return (
        <div className="space-y-3">
          <BiField label="Title" en={b.title.en} am={b.title.am} onChange={(v) => onChange({ ...b, title: v })} />
          <BiField label="Text" multiline en={b.text.en} am={b.text.am} onChange={(v) => onChange({ ...b, text: v })} />
        </div>
      );
    case "list":
      return (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[var(--accent)]" checked={!!b.ordered} onChange={(e) => onChange({ ...b, ordered: e.target.checked })} /> Numbered list
          </label>
          <BiList label="Item" items={b.items} max={8} multiline onChange={(items) => onChange({ ...b, items })} />
        </div>
      );
    case "terms":
      return (
        <div className="space-y-3">
          <BiField label="Title" en={b.title.en} am={b.title.am} onChange={(v) => onChange({ ...b, title: v })} />
          <BiList label="Term" items={b.items} max={12} onChange={(items) => onChange({ ...b, items })} />
        </div>
      );
    case "points":
      return (
        <div className="space-y-4">
          {b.items.map((it, i) => (
            <div key={i} className="rounded-2xl bg-paper p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <IconPicker value={it.icon} onChange={(icon) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, icon } : x)) })} />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove point ${i + 1}`}
                  disabled={b.items.length <= 2}
                  onClick={() => onChange({ ...b, items: b.items.filter((_, k) => k !== i) })}
                  icon={<Trash2 className="size-3.5" aria-hidden />}
                />
              </div>
              <div className="space-y-3">
                <BiField label="Title" en={it.title.en} am={it.title.am} onChange={(v) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, title: v } : x)) })} />
                <BiField label="Text" multiline rows={2} en={it.text.en} am={it.text.am} onChange={(v) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, text: v } : x)) })} />
              </div>
            </div>
          ))}
          {b.items.length < 6 && (
            <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => onChange({ ...b, items: [...b.items, { icon: "lightbulb", title: bi(), text: bi() }] })}>
              Add point
            </Button>
          )}
        </div>
      );
    case "table":
      return (
        <div className="space-y-3">
          <BiField label="Caption (optional)" en={b.caption?.en ?? ""} am={b.caption?.am ?? ""} onChange={(v) => onChange({ ...b, caption: v.en || v.am ? v : undefined })} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-1.5 text-sm">
              <thead>
                <tr>
                  {b.headers.map((h, c) => (
                    <th key={c} className="text-left align-top">
                      <div className="space-y-1">
                        <Input aria-label={`Column ${c + 1} header (English)`} value={h.en} placeholder="Header (EN)" onChange={(e) => onChange({ ...b, headers: b.headers.map((x, k) => (k === c ? { ...x, en: e.target.value } : x)) })} />
                        <Input aria-label={`Column ${c + 1} header (Amharic)`} className="am" value={h.am} placeholder="አማርኛ" onChange={(e) => onChange({ ...b, headers: b.headers.map((x, k) => (k === c ? { ...x, am: e.target.value } : x)) })} />
                        <button
                          type="button"
                          disabled={b.headers.length <= 1}
                          onClick={() => onChange({ ...b, headers: b.headers.filter((_, k) => k !== c), rows: b.rows.map((r) => r.filter((_, k) => k !== c)) })}
                          className="text-xs text-faint hover:text-bad disabled:opacity-40"
                        >
                          Remove column
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className="align-top">
                        <div className="space-y-1">
                          <Input aria-label={`Row ${r + 1}, column ${c + 1} (English)`} value={cell.en} onChange={(e) => onChange({ ...b, rows: b.rows.map((x, i) => (i === r ? x.map((y, k) => (k === c ? { ...y, en: e.target.value } : y)) : x)) })} />
                          <Input aria-label={`Row ${r + 1}, column ${c + 1} (Amharic)`} className="am" value={cell.am} onChange={(e) => onChange({ ...b, rows: b.rows.map((x, i) => (i === r ? x.map((y, k) => (k === c ? { ...y, am: e.target.value } : y)) : x)) })} />
                        </div>
                      </td>
                    ))}
                    <td className="align-top">
                      <Button size="sm" variant="ghost" aria-label={`Remove row ${r + 1}`} disabled={b.rows.length <= 1} onClick={() => onChange({ ...b, rows: b.rows.filter((_, i) => i !== r) })} icon={<Trash2 className="size-3.5" aria-hidden />} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} disabled={b.rows.length >= 20} onClick={() => onChange({ ...b, rows: [...b.rows, b.headers.map(() => bi())] })}>
              Add row
            </Button>
            <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} disabled={b.headers.length >= 6} onClick={() => onChange({ ...b, headers: [...b.headers, bi()], rows: b.rows.map((r) => [...r, bi()]) })}>
              Add column
            </Button>
          </div>
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {b.src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.src} alt="" className="h-24 w-36 rounded-xl object-cover ring-1 ring-line" />
            )}
            <label className="inline-flex">
              <input
                type="file"
                accept="image/webp,image/png,image/jpeg"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try {
                    const r = await uploadImage(f, `lessons/${lessonId}`);
                    onChange({ ...b, src: r.url, width: r.width, height: r.height });
                    toast({ title: "Image uploaded" });
                  } catch (err) {
                    toast({ title: "Upload failed", text: err instanceof Error ? err.message : undefined, tone: "error" });
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line hover:bg-paper">
                {uploading ? <span className="spinner !size-4" aria-hidden /> : <ImageUp className="size-4" aria-hidden />}
                {b.src ? "Replace image" : "Upload image"}
              </span>
            </label>
          </div>
          <Field label="Or image URL / /public path" hint="Use freely licensed images (Wikimedia Commons, Unsplash, unDraw). Shown 16:10.">
            <Input value={b.src} onChange={(e) => onChange({ ...b, src: e.target.value })} />
          </Field>
          <BiField label="Alt text (describe the image)" multiline rows={2} en={b.alt.en} am={b.alt.am} onChange={(v) => onChange({ ...b, alt: v })} />
          <BiField label="Caption (optional)" en={b.caption?.en ?? ""} am={b.caption?.am ?? ""} onChange={(v) => onChange({ ...b, caption: v.en || v.am ? v : undefined })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Credit line" hint="e.g. Photo: Name · CC BY-SA 4.0 · Wikimedia Commons">
              <Input value={b.credit} onChange={(e) => onChange({ ...b, credit: e.target.value })} />
            </Field>
            <Field label="Source page URL">
              <Input value={b.creditUrl ?? ""} onChange={(e) => onChange({ ...b, creditUrl: e.target.value })} />
            </Field>
          </div>
        </div>
      );
  }
}

export { IconPicker };
