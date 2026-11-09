import { ListPageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <ListPageSkeleton crumbs={2} cards={4} label="Loading grades" />;
}
