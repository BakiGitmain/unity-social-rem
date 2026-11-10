"use client";

import { useActionState, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, AtSign, Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { logIn, signUp, type AuthState } from "@/lib/auth/actions";
import { MIN_PASSWORD, USERNAME_RE, normalizeUsername, passwordStrength, safeNext } from "@/lib/auth/username";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";

type Availability = "idle" | "invalid" | "checking" | "available" | "taken";

const spring = { type: "spring", stiffness: 500, damping: 32 } as const;

export function AuthForm({ mode, locale }: { mode: "login" | "signup"; locale: Locale }) {
  const isSignup = mode === "signup";
  const next = safeNext(useSearchParams().get("next"));
  const [state, action, pending] = useActionState<AuthState, FormData>(isSignup ? signUp : logIn, null);

  const [username, setUsername] = useState(state?.username ?? "");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [avail, setAvail] = useState<Availability>("idle");
  const ids = { user: useId(), pass: useId(), status: useId(), err: useId() };
  const tr = (k: Parameters<typeof t>[1], v?: Record<string, string | number>) => t(locale, k, v);

  // Live "username taken" check while signing up (debounced).
  useEffect(() => {
    if (!isSignup) return;
    const u = normalizeUsername(username);
    if (!u) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvail("idle");
      return;
    }
    if (!USERNAME_RE.test(u)) {
      setAvail("invalid");
      return;
    }
    setAvail("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await createClient().from("profiles").select("id").eq("username", u).maybeSingle();
      if (cancelled) return;
      setAvail(error ? "idle" : data ? "taken" : "available");
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, isSignup]);

  const strength = passwordStrength(password);
  const blocked = pending || (isSignup && (avail === "taken" || avail === "invalid" || password.length < MIN_PASSWORD));
  const switchHref = `${isSignup ? "/login" : "/signup"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
  const am = locale === "am" ? "am" : "";

  return (
    <form action={action} className={`space-y-5 ${am}`} noValidate>
      <input type="hidden" name="next" value={next} />

      {/* Username */}
      <div>
        <label htmlFor={ids.user} className="mb-1.5 block text-sm font-medium text-ink">
          {tr("username")}
        </label>
        <div className="field group flex items-center gap-2 rounded-2xl bg-paper px-4 ring-1 ring-line transition-[box-shadow,background-color] duration-200 focus-within:bg-surface focus-within:ring-2 focus-within:ring-accent/50">
          <AtSign className="size-4 shrink-0 text-faint transition-colors group-focus-within:text-accent" aria-hidden />
          <input
            id={ids.user}
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            maxLength={21}
            required
            aria-describedby={isSignup ? ids.status : undefined}
            aria-invalid={avail === "invalid" || avail === "taken" || undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
            placeholder="your_name"
          />
          {isSignup && (
            <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
              {avail === "checking" && <Loader2 className="size-4 animate-spin text-faint" />}
              {avail === "available" && <Check className="size-4 text-good" />}
              {(avail === "taken" || avail === "invalid") && <X className="size-4 text-bad" />}
            </span>
          )}
        </div>
        {isSignup && (
          <div id={ids.status} aria-live="polite" className="min-h-6 pt-1.5 text-[13px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={avail}
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 3 }}
                transition={{ duration: 0.15 }}
                className={
                  avail === "available" ? "text-good" : avail === "taken" || avail === "invalid" ? "text-bad" : "text-faint"
                }
              >
                {avail === "available"
                  ? tr("usernameAvailable", { u: normalizeUsername(username) })
                  : avail === "taken"
                    ? tr("usernameTaken", { u: normalizeUsername(username) })
                    : avail === "invalid"
                      ? tr("usernameInvalid")
                      : avail === "checking"
                        ? tr("checking")
                        : tr("usernameHint")}
              </motion.p>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor={ids.pass} className="mb-1.5 block text-sm font-medium text-ink">
          {tr("password")}
        </label>
        <div className="group flex items-center gap-2 rounded-2xl bg-paper pr-1.5 pl-4 ring-1 ring-line transition-[box-shadow,background-color] duration-200 focus-within:bg-surface focus-within:ring-2 focus-within:ring-accent/50">
          <input
            id={ids.pass}
            name="password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? MIN_PASSWORD : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none"
          />
          <motion.button
            type="button"
            onClick={() => setShow((s) => !s)}
            whileTap={{ scale: 0.88 }}
            transition={spring}
            aria-label={show ? tr("hidePassword") : tr("showPassword")}
            aria-pressed={show}
            className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-line/60 hover:text-ink"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={show ? "hide" : "show"}
                initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="grid"
              >
                {show ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
        {isSignup && (
          <div className="pt-2">
            <div className="flex gap-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                  <motion.span
                    className={`block h-full rounded-full ${strength === 2 ? "bg-good" : strength === 1 ? "bg-accent" : "bg-tip"}`}
                    initial={false}
                    animate={{ width: password.length && i <= strength ? "100%" : "0%" }}
                    transition={spring}
                  />
                </span>
              ))}
            </div>
            <p className="pt-1.5 text-[13px] text-faint" aria-live="polite">
              {password.length === 0
                ? tr("passwordMin")
                : password.length < MIN_PASSWORD
                  ? tr("passwordMin")
                  : `${tr(strength === 2 ? "strengthStrong" : strength === 1 ? "strengthOkay" : "strengthWeak")} · ${tr("strengthTip")}`}
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {state?.error && !pending && (
          <motion.p
            id={ids.err}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", x: [0, -6, 6, -3, 3, 0] }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-start gap-2 overflow-hidden rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {tr(state.error)}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={blocked}
        whileTap={blocked ? undefined : { scale: 0.98 }}
        transition={spring}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
      >
        {pending ? (
          <>
            <span className="spinner !border-white/30 !border-t-white" aria-hidden />
            {tr(isSignup ? "creatingAccount" : "loggingIn")}
          </>
        ) : (
          <>
            {tr(isSignup ? "signupButton" : "loginButton")}
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </motion.button>

      <p className="text-center text-sm text-muted">
        {tr(isSignup ? "haveAccount" : "newHere")}{" "}
        <Link href={switchHref} className="font-medium text-accent-ink underline-offset-4 hover:underline">
          {tr(isSignup ? "login" : "signup")}
        </Link>
      </p>
    </form>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-12 w-full !rounded-2xl" />
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-12 w-full !rounded-2xl" />
      <div className="skeleton h-12 w-full !rounded-2xl" />
    </div>
  );
}
