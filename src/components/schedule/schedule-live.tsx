"use client";

import { useRouter } from "next/navigation";
import { useRealtime } from "@/components/live";

/** Students see timetable changes (cancelled class, room change, holiday…) live, without reloading. */
export function ScheduleLive() {
  const router = useRouter();
  useRealtime("schedule", [{ table: "schedule_overrides" }, { table: "schedule_entries" }], () => router.refresh(), {
    onResume: () => router.refresh(),
  });
  return null;
}
