import { Skeleton, TableSkeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement des classes">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 w-80 max-w-full" />
      </div>
      <TableSkeleton rows={8} />
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
