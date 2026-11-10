import Link from "next/link";
import { Compass } from "lucide-react";

// not-found.tsx gets no params, so it stays bilingual-neutral: short English with Amharic underneath.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Compass className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-semibold text-ink">We couldn&apos;t find that page</h1>
      <p className="am mt-1 text-muted">ያንን ገጽ ማግኘት አልቻልንም</p>
      <Link href="/" className="mt-8 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
        Home · መነሻ
      </Link>
    </div>
  );
}
