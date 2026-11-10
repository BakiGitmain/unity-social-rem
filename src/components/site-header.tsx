import Link from "next/link";
import { SiteName } from "@/components/nav/site-name";
import { SiteLangSwitch } from "@/components/nav/site-lang-switch";
import { AccountMenu } from "@/components/nav/account-menu";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import type { Locale } from "@/lib/locale";

export function SiteHeader({ locale }: { locale: Locale }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto] items-center gap-3 px-4 sm:px-6 md:h-16 md:grid-cols-[1fr_auto_1fr]">
          <Link href="/" className="flex w-fit items-center gap-2.5 font-semibold tracking-tight text-ink">
            <SiteName />
          </Link>
          <DesktopNav locale={locale} />
          <div className="flex items-center justify-end gap-2">
            <SiteLangSwitch locale={locale} />
            <div className="hidden md:block">
              <AccountMenu locale={locale} />
            </div>
          </div>
        </div>
      </header>
      <BottomTabBar locale={locale} />
    </>
  );
}
