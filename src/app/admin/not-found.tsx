import Link from "next/link";

// Looks like any other missing page: the admin area must not reveal that it exists.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink">We couldn&apos;t find that page</h1>
      <p className="am mt-1 text-muted">ያንን ገጽ ማግኘት አልቻልንም</p>
      <Link href="/" className="mt-8 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
        Home · መነሻ
      </Link>
    </div>
  );
}
