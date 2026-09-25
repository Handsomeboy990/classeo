import { Skeleton } from "@/components/kit/skeletons";

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement en cours">
      <div>
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="mt-2 w-96 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-full max-w-sm" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="w-full" />
            <Skeleton className="w-2/3" />
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}

export function ArticleSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-4" role="status" aria-label="Chargement en cours">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="w-full" />
      <Skeleton className="w-full" />
      <Skeleton className="w-2/3" />
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-6" role="status" aria-label="Chargement en cours">
      <Skeleton className="h-8 w-64" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
