"use client";

import { useSiteSettings } from "@/components/site-settings";

/** The optional custom message from Admin → Site settings → Maintenance. */
export function MaintenanceMessage() {
  const { settings } = useSiteSettings();
  const { message_en, message_am } = settings.maintenance;
  if (!message_en && !message_am) return null;
  return (
    <div className="mt-6 w-full rounded-2xl bg-surface px-5 py-4 text-left ring-1 ring-line">
      {message_en && <p className="text-ink">{message_en}</p>}
      {message_am && <p className="am mt-1 text-muted">{message_am}</p>}
    </div>
  );
}
