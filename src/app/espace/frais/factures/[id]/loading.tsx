import { Skeleton, TableSkeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de la facture">
      <div>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-2 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <TableSkeleton rows={4} />
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
