"use client";

import { useState } from "react";
import { ImageUp, Save } from "lucide-react";
import { SetCrumb } from "@/components/admin/shell";
import { useToast } from "@/components/admin/toast";
import { BiField, Button, Card, CardTitle, Field, Input, PageHeader, Select, Switch } from "@/components/admin/ui";
import { SectionIcon } from "@/components/study/section-icon";
import { updateSubject } from "@/lib/admin/actions/content";
import { ICON_NAMES } from "@/lib/admin/lesson-validate";
import { SUBJECT_THEMES, subjectStyle } from "@/lib/subjects";
import { uploadImage } from "@/components/admin/upload";

type Subject = {
  id: string;
  slug: string;
  name_en: string;
  name_am: string;
  description_en: string;
  description_am: string;
  color: string | null;
  icon: string | null;
  illustration: string | null;
  status: "published" | "draft" | "coming_soon";
};

const PRESETS = ["#0f766e", "#2563c9", "#c0620e", "#b4472e", "#15803d", "#0e7490", "#be123c", "#a16207"];

export function SubjectSettings({ subject }: { subject: Subject }) {
  const toast = useToast();
  const [s, setS] = useState(subject);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const color = s.color ?? SUBJECT_THEMES[s.slug]?.accent ?? "#0f766e";
  const illustration = s.illustration || `/illustrations/subjects/${s.slug}.svg`;

  const save = async () => {
    setBusy(true);
    const r = await updateSubject(s.id, {
      name_en: s.name_en,
      name_am: s.name_am,
      description_en: s.description_en,
      description_am: s.description_am,
      color: s.color,
      icon: s.icon,
      illustration: s.illustration,
      status: s.status,
    });
    setBusy(false);
    if (r.ok) {
      toast({ title: "Subject saved" });
    } else toast({ title: "Not saved", text: r.error, tone: "error" });
  };

  return (
    <div>
      <SetCrumb label={s.name_en} />
      <PageHeader
        title={`${s.name_en} settings`}
        sub="Name, colour, icon, illustration and visibility"
        actions={
          <Button variant="primary" loading={busy} icon={<Save className="size-4" aria-hidden />} onClick={save}>
            Save
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardTitle>Name and description</CardTitle>
            <div className="space-y-4">
              <BiField label="Name" en={s.name_en} am={s.name_am} onChange={(v) => setS({ ...s, name_en: v.en, name_am: v.am })} />
              <BiField label="Description" multiline en={s.description_en} am={s.description_am} onChange={(v) => setS({ ...s, description_en: v.en, description_am: v.am })} />
            </div>
          </Card>
          <Card>
            <CardTitle sub="Used for the cards, buttons and progress bars of this subject">Colour and icon</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={color.toLowerCase() === c}
                  onClick={() => setS({ ...s, color: c })}
                  className={`size-9 rounded-full ring-offset-2 transition-shadow ${color.toLowerCase() === c ? "ring-2 ring-ink" : ""}`}
                  style={{ background: c }}
                />
              ))}
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="color" value={color} onChange={(e) => setS({ ...s, color: e.target.value })} className="size-9 cursor-pointer rounded-full" aria-label="Custom colour" />
                Custom
              </label>
              <Button size="sm" variant="ghost" onClick={() => setS({ ...s, color: null })}>
                Use default
              </Button>
            </div>
            <Field label="Icon" className="mt-4">
              <div className="flex items-center gap-2">
                <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent" style={subjectStyle(s.slug, color)}>
                  <SectionIcon name={s.icon ?? "book-open"} />
                </span>
                <Select value={s.icon ?? ""} onChange={(e) => setS({ ...s, icon: e.target.value || null })}>
                  <option value="">Default</option>
                  {ICON_NAMES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
          </Card>
          <Card>
            <CardTitle>Visibility</CardTitle>
            <div className="space-y-4">
              <Switch
                label="Coming soon"
                description="Shown on the home page, but students can't open it yet."
                checked={s.status === "coming_soon"}
                onChange={(v) => setS({ ...s, status: v ? "coming_soon" : "published" })}
              />
              <Switch
                label="Draft (hidden)"
                description="Hidden from students completely."
                checked={s.status === "draft"}
                onChange={(v) => setS({ ...s, status: v ? "draft" : "published" })}
              />
            </div>
          </Card>
        </div>

        {/* preview */}
        <div>
          <Card className="!p-0 overflow-hidden" style={subjectStyle(s.slug, color)}>
            <div className="bg-[var(--accent-tint)] px-6 pt-6 pb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={illustration} alt="" className="mx-auto h-36 w-auto" />
            </div>
            <div className="p-5">
              <p className="text-lg font-semibold text-ink">{s.name_en}</p>
              <p className="am text-sm text-muted">{s.name_am}</p>
              <span className="mt-3 inline-block rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink">Preview</span>
            </div>
          </Card>
          <Card className="mt-4">
            <CardTitle sub="Freely licensed (unDraw, Wikimedia, Unsplash). PNG/JPEG/WebP, max 5 MB.">Illustration</CardTitle>
            <Field label="Image URL or /public path">
              <Input value={s.illustration ?? ""} onChange={(e) => setS({ ...s, illustration: e.target.value || null })} placeholder={`/illustrations/subjects/${s.slug}.svg`} />
            </Field>
            <label className="mt-3 inline-flex">
              <input
                type="file"
                accept="image/webp,image/png,image/jpeg"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try {
                    const { url } = await uploadImage(f, `subjects/${s.slug}`);
                    setS((x) => ({ ...x, illustration: url }));
                    toast({ title: "Uploaded. Press Save to use it." });
                  } catch (err) {
                    toast({ title: "Upload failed", text: err instanceof Error ? err.message : undefined, tone: "error" });
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line hover:bg-paper">
                {uploading ? <span className="spinner !size-4" aria-hidden /> : <ImageUp className="size-4" aria-hidden />} Upload image
              </span>
            </label>
          </Card>
        </div>
      </div>
    </div>
  );
}
