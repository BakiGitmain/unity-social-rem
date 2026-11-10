import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { isLocale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  return { title: t(isLocale(locale) ? locale : "en", "login") };
}

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  return <AuthCard mode="login" locale={isLocale(locale) ? locale : "en"} />;
}
