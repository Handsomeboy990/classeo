import { Skeleton, TableSkeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de la saisie des notes">
      <div>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-2 w-96 max-w-full" />
      </div>
      <TableSkeleton rows={12} />
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
