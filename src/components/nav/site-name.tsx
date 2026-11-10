"use client";

import { LogoMark } from "@/components/subject-icon";
import { useSiteSettings } from "@/components/site-settings";

/** Logo + site name from Admin → Site settings (falls back to the defaults). */
export function SiteName() {
  const { settings } = useSiteSettings();
  const { name, logo_url } = settings.site;
  return (
    <>
      {logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo_url} alt="" width={32} height={32} className="size-8 rounded-lg object-contain" />
      ) : (
        <LogoMark />
      )}
      <span className="text-[15px] sm:text-base">{name || "Unity Social Rem"}</span>
    </>
  );
}
