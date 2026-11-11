import { PageSkeleton } from "@/components/admin/skeletons";

/** Suspense boundary for this route: the page reads the session at request time (requireAdmin). */
export default function Loading() {
  return <PageSkeleton />;
}
