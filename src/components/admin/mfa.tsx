"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { KeyRound, LifeBuoy, ShieldCheck, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logMfaEvent } from "@/lib/admin/actions/misc";
import { Button, ErrorState } from "@/components/admin/ui";

type Stage =
  | { kind: "loading" }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string }
  | { kind: "error"; message: string };

/**
 * 2FA for the admin area (Supabase MFA, TOTP authenticator app).
 * First visit: scan the QR code + enter a code. Later visits: enter a code. Success upgrades the session to AAL2.
 */
export function MfaScreen({ username }: { username: string }) {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setStage({ kind: "error", message: "Could not load 2FA. Please reload the page." });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setStage({ kind: "verify", factorId: verified.id });
      // Remove half-finished setups, then start a fresh one.
      for (const f of data.all.filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const en = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Admin ${new Date().toISOString().slice(0, 10)}`, issuer: "Unity Social Rem" });
      if (en.error || !en.data) return setStage({ kind: "error", message: "Could not start 2FA setup. Please reload the page." });
      setStage({ kind: "enroll", factorId: en.data.id, qr: en.data.totp.qr_code, secret: en.data.totp.secret });
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stage.kind !== "enroll" && stage.kind !== "verify") return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: stage.factorId, code: code.replace(/\s/g, "") });
    if (error) {
      setBusy(false);
      setErr("That code didn't work. Check the time on your phone and try the newest code.");
      return;
    }
    await logMfaEvent(stage.kind === "enroll" ? "enrolled" : "verified");
    window.location.reload();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="w-full max-w-md rounded-3xl bg-surface p-6 ring-1 ring-line sm:p-8"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink">{stage.kind === "enroll" ? "Set up two-step verification" : "Two-step verification"}</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as <span className="font-medium text-ink">@{username}</span>. The admin area needs a code from your authenticator app.
        </p>

        {stage.kind === "loading" && (
          <div className="mt-8 flex justify-center" role="status">
            <span className="spinner" aria-hidden />
          </div>
        )}
        {stage.kind === "error" && (
          <div className="mt-6">
            <ErrorState text={stage.message} />
          </div>
        )}

        {stage.kind === "enroll" && (
          <div className="mt-6 space-y-4">
            <ol className="space-y-2 text-sm text-ink/80">
              <li className="flex gap-2">
                <Smartphone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                Open an authenticator app (Google Authenticator, Microsoft Authenticator, 2FAS…) and scan this code.
              </li>
            </ol>
            <div className="flex justify-center rounded-2xl bg-white p-4 ring-1 ring-line">
              {/* Supabase returns the QR code as an SVG data URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stage.qr} alt="QR code for your authenticator app" width={180} height={180} className="size-44" />
            </div>
            <details className="rounded-2xl bg-paper px-4 py-3 text-sm">
              <summary className="flex cursor-pointer items-center gap-2 font-medium text-ink">
                <KeyRound className="size-4 text-accent" aria-hidden /> Can&apos;t scan? Enter this key
              </summary>
              <p className="mt-2 font-mono text-[13px] break-all text-ink select-all">{stage.secret}</p>
            </details>
            <div className="flex gap-2 rounded-2xl bg-tip-soft px-4 py-3 text-[13px] text-ink/80">
              <LifeBuoy className="mt-0.5 size-4 shrink-0 text-tip" aria-hidden />
              <p>
                <span className="font-semibold text-tip">Recovery:</span> write the key above on paper and keep it safe. With it you can add the account
                to a new phone. If you lose both, 2FA can be reset with a database migration (see CLAUDE.md → Admin → “Lost authenticator”).
              </p>
            </div>
          </div>
        )}

        {(stage.kind === "enroll" || stage.kind === "verify") && (
          <form onSubmit={submit} className="mt-6">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink/80">6-digit code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={7}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-14 w-full rounded-2xl bg-paper text-center font-mono text-2xl tracking-[0.4em] text-ink ring-1 ring-line focus:bg-surface focus:ring-2 focus:ring-accent/40"
                aria-label="6-digit code"
              />
            </label>
            {err && <p className="mt-2 text-sm text-bad" role="alert">{err}</p>}
            <Button type="submit" variant="primary" loading={busy} disabled={code.replace(/\s/g, "").length !== 6} className="mt-4 w-full">
              {stage.kind === "enroll" ? "Turn on 2FA" : "Verify"}
            </Button>
          </form>
        )}

        <Link href="/" className="mt-6 block text-center text-sm text-muted hover:text-ink">
          Back to the site
        </Link>
      </motion.div>
    </div>
  );
}
