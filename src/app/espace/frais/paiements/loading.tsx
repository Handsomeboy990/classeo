import { Skeleton, TableSkeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement des paiements">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-11 w-full max-w-xl" />
      <TableSkeleton rows={10} />
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
