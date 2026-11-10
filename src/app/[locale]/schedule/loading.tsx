import { ScheduleSkeleton } from "@/components/schedule/schedule-view";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-live="polite">
      <span className="sr-only">Loading schedule</span>
      <ScheduleSkeleton />
    </div>
  );
}
