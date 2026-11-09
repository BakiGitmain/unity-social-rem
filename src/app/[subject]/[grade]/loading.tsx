import { ListPageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <ListPageSkeleton crumbs={3} cards={2} label="Loading units" />;
}
