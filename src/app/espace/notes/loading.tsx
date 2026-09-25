import { Skeleton, TableSkeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement des fiches de notes">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 w-72 max-w-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-11 w-52" />
        <Skeleton className="h-11 w-52" />
      </div>
      <TableSkeleton rows={10} />
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
