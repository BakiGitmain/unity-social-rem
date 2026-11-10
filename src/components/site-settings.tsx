"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/components/live";
import { DEFAULT_SETTINGS, mergeSettings, type SiteSettings } from "@/lib/settings";

/**
 * Public site settings (feature flags, site name, maintenance text), read in the browser so pages stay static.
 * They update LIVE (Supabase Realtime): the AI kill switch hides Rem at once, and switching maintenance mode
 * on/off reloads the page so the server (proxy) shows the right page. The rules are ALSO enforced on the server.
 */
const Ctx = createContext<{ settings: SiteSettings; loaded: boolean }>({ settings: DEFAULT_SETTINGS, loaded: false });

const CACHE_KEY = "usr-site-settings";

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ settings: SiteSettings; loaded: boolean }>({ settings: DEFAULT_SETTINGS, loaded: false });
  const maintenance = useRef<boolean | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().from("app_settings").select("key, value").eq("is_public", true);
    if (!data) return;
    const settings = mergeSettings(data);
    // Maintenance changed while the page is open → reload (the proxy decides what this visitor may see).
    if (maintenance.current !== null && maintenance.current !== settings.maintenance.enabled) {
      window.location.reload();
      return;
    }
    maintenance.current = settings.maintenance.enabled;
    setState({ settings, loaded: true });
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {}
  }, []);

  useEffect(() => {
    // Last known settings first (no flicker on the next visit), then fresh ones.
    let cached: SiteSettings | null = null;
    try {
      const raw = window.sessionStorage.getItem(CACHE_KEY);
      if (raw) cached = mergeSettings(JSON.parse(raw));
    } catch {}
    const t = setTimeout(() => {
      if (cached) setState({ settings: cached, loaded: true });
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  useRealtime("site-settings", [{ table: "app_settings" }], () => void load(), { onResume: () => void load() });

  return <Ctx value={state}>{children}</Ctx>;
}

export const useSiteSettings = () => useContext(Ctx);
