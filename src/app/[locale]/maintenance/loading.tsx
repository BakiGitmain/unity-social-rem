import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 sm:py-24" role="status">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-44 w-56 !rounded-3xl" />
      <Skeleton className="mt-8 h-8 w-72" />
      <Skeleton className="mt-3 h-5 w-48" />
    </div>
  );
}
