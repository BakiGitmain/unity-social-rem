import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Lexend, Noto_Sans_Ethiopic } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MotionProvider } from "@/components/motion";
import { UserProvider } from "@/components/user-provider";
import { SiteSettingsProvider } from "@/components/site-settings";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { ProgressSync } from "@/components/progress-sync";
import { LOCALES, isLocale } from "@/lib/locale";
import "../globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  display: "swap",
});

const ethiopic = Noto_Sans_Ethiopic({
  variable: "--font-ethiopic",
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Unity Social Rem",
    template: "%s · Unity Social Rem",
  },
  description: "Study notes, quick revision topics and quizzes for our class, in English and Amharic.",
};

export const viewport: Viewport = {
  themeColor: "#faf8f3",
  viewportFit: "cover",
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} className={`${lexend.variable} ${ethiopic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <MotionProvider>
          <SiteSettingsProvider>
            <UserProvider>
              <ProgressSync />
              <SiteHeader locale={locale} />
              <AnnouncementBanner locale={locale} />
              <main className="flex-1">{children}</main>
              <SiteFooter locale={locale} />
            </UserProvider>
          </SiteSettingsProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
