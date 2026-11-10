"use client";

import { useState } from "react";
import { ImageUp, Save, Wrench } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";
import { saveFeatures, saveMaintenance, saveSiteSettings } from "@/lib/admin/actions/settings";
import { uploadImage } from "@/components/admin/upload";
import { ConfirmDialog } from "@/components/admin/dialog";
import { useToast } from "@/components/admin/toast";
import { useLiveRefresh, useServerState } from "@/components/live";
import { Badge, BiField, Button, Card, CardTitle, Field, Input, PageHeader, Select, Switch } from "@/components/admin/ui";

export function SiteSettingsAdmin({ settings }: { settings: SiteSettings }) {
  const toast = useToast();
  const [site, setSite] = useState(settings.site);
  // Switches follow the database live (another admin, the command palette, or the AI page can change them).
  const [features, setFeatures] = useServerState(settings.features);
  const [maint, setMaint] = useServerState(settings.maintenance);
  useLiveRefresh({ key: "admin-settings", tables: ["app_settings"], pollMs: 0 });
  const [confirm, setConfirm] = useState<null | boolean>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const done = (title: string, r: { ok: boolean; error?: string }) => {
    setBusy(null);
    if (!r.ok) return toast({ title: "Not saved", text: r.error, tone: "error" });
    toast({ title });
  };

  /** Feature switches save at once (optimistic, rolled back on error). */
  const flip = async (key: keyof SiteSettings["features"], v: boolean) => {
    const prev = features;
    const next = { ...features, [key]: v };
    setFeatures(next);
    const r = await saveFeatures(next);
    if (!r.ok) {
      setFeatures(prev);
      toast({ title: "Not saved", text: r.error, tone: "error" });
    } else toast({ title: `${key.replace("_", " ")} ${v ? "on" : "off"}` });
  };

  return (
    <div>
      <PageHeader title="Site settings" sub="Maintenance mode, feature flags, name, logo and default language" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="maintenance" className={maint.enabled ? "!ring-2 !ring-tip" : ""}>
          <CardTitle action={maint.enabled ? <Badge tone="warn">ON</Badge> : <Badge>off</Badge>} sub="Students see a friendly “we're making the site better” page. Admins keep full access.">
            <span className="inline-flex items-center gap-2">
              <Wrench className="size-4 text-tip" aria-hidden /> Maintenance mode
            </span>
          </CardTitle>
          <div className="space-y-4">
            <BiField label="Message (optional)" multiline rows={2} en={maint.message_en} am={maint.message_am} onChange={(v) => setMaint({ ...maint, message_en: v.en, message_am: v.am })} />
            <div className="flex flex-wrap gap-2">
              {maint.enabled ? (
                <Button variant="primary" onClick={() => setConfirm(false)}>
                  Turn maintenance OFF
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setConfirm(true)}>
                  Turn maintenance ON
                </Button>
              )}
              <Button
                loading={busy === "maint"}
                icon={<Save className="size-4" aria-hidden />}
                onClick={async () => {
                  setBusy("maint");
                  done("Message saved", await saveMaintenance(maint));
                }}
              >
                Save message
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle sub="Switches apply immediately (the server also enforces them).">Feature flags</CardTitle>
          <div className="space-y-4">
            <Switch label="Sign-ups open" description="New students can create an account." checked={features.signups} onChange={(v) => void flip("signups", v)} />
            <Switch label="AI tutor (Rem)" description="The study chat on lesson pages." checked={features.ai_tutor} onChange={(v) => void flip("ai_tutor", v)} />
            <Switch label="Schedule" description="The Today card and the Schedule page." checked={features.schedule} onChange={(v) => void flip("schedule", v)} />
            <Switch label="Learn mode" description="One part per screen. Off = notes open in Read all." checked={features.learn_mode} onChange={(v) => void flip("learn_mode", v)} />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle
            action={
              <Button
                variant="primary"
                size="sm"
                loading={busy === "site"}
                icon={<Save className="size-3.5" aria-hidden />}
                onClick={async () => {
                  setBusy("site");
                  done("Site settings saved", await saveSiteSettings(site));
                }}
              >
                Save
              </Button>
            }
          >
            Name, logo and language
          </CardTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Site name">
              <Input value={site.name} maxLength={60} onChange={(e) => setSite({ ...site, name: e.target.value })} />
            </Field>
            <Field label="Default site language" hint="For visitors who haven't chosen one">
              <Select value={site.default_locale} onChange={(e) => setSite({ ...site, default_locale: e.target.value as "en" | "am" })}>
                <option value="en">English</option>
                <option value="am">አማርኛ (Amharic)</option>
              </Select>
            </Field>
            <Field label="Logo (optional)" hint="Square PNG/WebP. Empty = the default logo.">
              <div className="flex items-center gap-2">
                {site.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={site.logo_url} alt="" className="size-10 rounded-lg object-contain ring-1 ring-line" />
                )}
                <Input value={site.logo_url ?? ""} onChange={(e) => setSite({ ...site, logo_url: e.target.value || null })} placeholder="https://…" />
                <label className="inline-flex shrink-0">
                  <input
                    type="file"
                    accept="image/webp,image/png,image/jpeg"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploading(true);
                      try {
                        const { url } = await uploadImage(f, "site");
                        setSite((s) => ({ ...s, logo_url: url }));
                        toast({ title: "Logo uploaded. Press Save." });
                      } catch (err) {
                        toast({ title: "Upload failed", text: err instanceof Error ? err.message : undefined, tone: "error" });
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  <span className="grid size-10 cursor-pointer place-items-center rounded-xl ring-1 ring-line hover:bg-paper" aria-label="Upload logo">
                    {uploading ? <span className="spinner !size-4" aria-hidden /> : <ImageUp className="size-4" aria-hidden />}
                  </span>
                </label>
              </div>
            </Field>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? "Turn maintenance mode ON" : "Turn maintenance mode OFF"}
        message={confirm ? "Every student page is replaced by the maintenance page (within ~15 seconds). You keep full access as an admin." : "The site opens for students again."}
        confirmText="maintenance"
        actionLabel={confirm ? "Turn ON" : "Turn OFF"}
        danger={!!confirm}
        onConfirm={async () => {
          const next = { ...maint, enabled: !!confirm };
          setBusy("maint");
          const r = await saveMaintenance(next);
          if (r.ok) setMaint(next);
          setConfirm(null);
          done(confirm ? "Maintenance mode is ON" : "Maintenance mode is OFF", r);
        }}
      />
    </div>
  );
}
