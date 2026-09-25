import { Skeleton, TableSkeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-label="Chargement du registre des documents" className="flex flex-col gap-6">
      <Skeleton className="h-9 w-72" />
      <TableSkeleton rows={4} />
      <TableSkeleton rows={6} />
    </div>
  );
}
