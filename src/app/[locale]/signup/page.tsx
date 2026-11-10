import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { isLocale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  return { title: t(isLocale(locale) ? locale : "en", "signup") };
}

export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  return <AuthCard mode="signup" locale={isLocale(locale) ? locale : "en"} />;
}
