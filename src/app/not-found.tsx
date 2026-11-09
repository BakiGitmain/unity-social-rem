import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Compass className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-semibold text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">The lesson or subject may have moved, or the link has a typo.</p>
      <Link href="/" className="mt-8 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
        Go to all subjects
      </Link>
    </div>
  );
}
