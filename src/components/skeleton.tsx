/** Shimmering placeholder blocks that mirror each page's real layout. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

function Shell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function CrumbsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-4 w-20" />
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <Shell label="Loading subjects">
      <div className="max-w-2xl space-y-4 py-6">
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5">
            <Skeleton className="size-12 rounded-xl" />
            <Skeleton className="mt-5 h-5 w-32" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
            <Skeleton className="mt-6 h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function ListPageSkeleton({ crumbs = 1, cards = 4, label }: { crumbs?: number; cards?: number; label: string }) {
  return (
    <Shell label={label}>
      <CrumbsSkeleton count={crumbs} />
      <div className="mt-6 flex items-center gap-4">
        <Skeleton className="size-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function UnitSkeleton() {
  return (
    <Shell label="Loading unit">
      <CrumbsSkeleton count={3} />
      <Skeleton className="mt-6 h-5 w-24 rounded-full" />
      <Skeleton className="mt-3 h-9 w-[28rem] max-w-full" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <Skeleton className="mt-10 h-5 w-48" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <Skeleton className="h-10 w-14 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-64 max-w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function LessonSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8" role="status" aria-live="polite">
      <span className="sr-only">Loading lesson</span>
      <CrumbsSkeleton count={4} />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-9 w-[30rem] max-w-full" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11 w-80 max-w-full rounded-full" />
        <Skeleton className="h-9 w-56 rounded-full" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_240px]">
        <div className="space-y-6">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="h-6 w-64 max-w-full" />
              </div>
              <Skeleton className="mt-6 h-4 w-full" />
              <Skeleton className="mt-2.5 h-4 w-11/12" />
              <Skeleton className="mt-2.5 h-4 w-4/5" />
              <Skeleton className="mt-6 h-28 w-full rounded-xl" />
              <Skeleton className="mt-6 h-16 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="hidden space-y-3 lg:block">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
