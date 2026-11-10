import { Sk } from "@/components/admin/ui";

/** Shell-shaped skeleton while the admin check runs. */
export function AdminSkeleton() {
  return (
    <div className="flex min-h-dvh" role="status" aria-label="Loading">
      <div className="hidden w-[248px] shrink-0 border-r border-line bg-surface/70 p-4 lg:block">
        <Sk className="h-9 w-32" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 9 }, (_, i) => (
            <Sk key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-14 border-b border-line" />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}

/** Generic page skeleton: title, KPI row, two panels. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Sk className="h-8 w-56" />
      <Sk className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Sk key={i} className="h-28 !rounded-3xl" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Sk className="h-72 !rounded-3xl" />
        <Sk className="h-72 !rounded-3xl" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <Sk className="h-8 w-48" />
      <Sk className="mt-6 h-10 w-full !rounded-full" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <Sk key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
