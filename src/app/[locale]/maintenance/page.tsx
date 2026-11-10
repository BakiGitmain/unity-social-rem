import type { Metadata } from "next";
import Image from "next/image";
import { Wrench } from "lucide-react";
import { MaintenanceMessage } from "@/components/maintenance-message";

export const metadata: Metadata = { title: "Back soon", robots: { index: false } };

/** Shown to students while maintenance mode is on (the proxy rewrites every page here with a 503). */
export default function MaintenancePage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24">
      <Image src="/illustrations/rest-day.svg" alt="" width={320} height={240} priority className="h-44 w-auto sm:h-52" />
      <span className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent-ink uppercase">
        <Wrench className="size-3.5" aria-hidden />
        Maintenance · ጥገና
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">We&apos;re making the site better</h1>
      <p className="am mt-1 text-lg text-muted">ድረ ገጹን እያሻሻልን ነው</p>
      <MaintenanceMessage />
      <p className="mt-8 text-sm text-faint">Please check back in a little while. · እባክዎ ትንሽ ቆይተው ይመለሱ።</p>
    </div>
  );
}
