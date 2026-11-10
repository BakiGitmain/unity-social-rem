import { Suspense } from "react";
import Image from "next/image";
import { AuthForm, AuthFormSkeleton } from "@/components/auth/auth-form";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";

/** Centered card used by /login and /signup. */
export function AuthCard({ mode, locale }: { mode: "login" | "signup"; locale: Locale }) {
  const isSignup = mode === "signup";
  const am = locale === "am" ? "am" : "";
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-14rem)] max-w-md flex-col justify-center px-4 py-8 sm:py-12">
      <div className="rounded-[2rem] bg-surface px-6 pt-6 pb-7 ring-1 ring-line sm:px-8 sm:pt-8 sm:pb-8">
        <div className="-mx-2 rounded-3xl bg-[var(--accent-tint)] px-6 py-5">
          <Image
            src={isSignup ? "/illustrations/auth/signup.svg" : "/illustrations/auth/login.svg"}
            alt=""
            width={360}
            height={260}
            priority
            className="mx-auto h-32 w-auto sm:h-36"
          />
        </div>
        <h1 className={`mt-6 text-2xl font-semibold tracking-tight text-ink ${am}`}>
          {t(locale, isSignup ? "signupTitle" : "loginTitle")}
        </h1>
        <p className={`mt-1 text-muted ${am}`}>{t(locale, isSignup ? "signupSub" : "loginSub")}</p>
        <div className="mt-6">
          {/* The form reads ?next=…, a runtime value, so it streams in behind this boundary. */}
          <Suspense fallback={<AuthFormSkeleton />}>
            <AuthForm mode={mode} locale={locale} />
          </Suspense>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-faint">
        Illustration:{" "}
        <a href="https://undraw.co" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          unDraw
        </a>
      </p>
    </div>
  );
}
