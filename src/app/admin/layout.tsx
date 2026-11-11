import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Kalam, Lexend, Noto_Sans_Ethiopic } from "next/font/google";
import { MotionProvider } from "@/components/motion";
import { ToastProvider } from "@/components/admin/toast";
import { AdminShell } from "@/components/admin/shell";
import { MfaScreen } from "@/components/admin/mfa";
import { AdminSkeleton } from "@/components/admin/skeletons";
import { getAdminGate } from "@/lib/admin/auth";
import "katex/dist/katex.min.css";
import "../globals.css";

const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"], display: "swap" });
const ethiopic = Noto_Sans_Ethiopic({ variable: "--font-ethiopic", subsets: ["ethiopic"], weight: ["400", "500", "600", "700"], display: "swap" });

// Handwriting for paper-mode worked examples.
const hand = Kalam({ variable: "--font-hand", subsets: ["latin"], weight: ["400", "700"], display: "swap" });

// Admin pages are never indexed (the proxy also sends X-Robots-Tag: noindex).
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = { themeColor: "#faf8f3" };

/**
 * Security layer 2 of 3 (after the proxy, before every action): the server decides what renders.
 * Not an admin → 404. Admin without 2FA (AAL2) → only the 2FA screen. Nothing else renders before this check.
 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  const gate = await getAdminGate();
  if (gate.access === "not_found" || gate.access === "expired") notFound();
  if (gate.access === "mfa") return <MfaScreen username={gate.username ?? ""} />;
  return <AdminShell username={gate.username ?? ""}>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lexend.variable} ${ethiopic.variable} ${hand.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper">
        <MotionProvider>
          <ToastProvider>
            <Suspense fallback={<AdminSkeleton />}>
              <AdminGate>{children}</AdminGate>
            </Suspense>
          </ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
