import { Skeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de la fiche de notes">
      <div>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-2 w-96 max-w-full" />
      </div>
      <div className="rounded-card border border-border bg-surface">
        <div className="border-b border-border p-4">
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
            <Skeleton className="w-48" />
            {Array.from({ length: 4 }, (__, j) => (
              <Skeleton key={j} className="h-9 w-16" />
            ))}
            <Skeleton className="ml-auto w-28" />
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
