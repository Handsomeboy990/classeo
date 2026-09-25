import { Skeleton } from "@/components/kit/skeletons";

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement en cours">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 w-80 max-w-full" />
      </div>
      <div className="rounded-card border border-border bg-surface">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-3 border-b border-border px-5 py-4 last:border-0">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="w-1/3" />
              <Skeleton className="w-2/3" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-4" role="status" aria-label="Chargement en cours">
      <Skeleton className="h-8 w-72 max-w-full" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className={i % 2 ? "ml-auto h-16 w-2/3" : "h-16 w-2/3"} />
      ))}
      <Skeleton className="h-24 w-full" />
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
