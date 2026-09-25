import { Skeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de vos enfants">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 w-80 max-w-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-card" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-card border border-border bg-surface p-5">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="mt-2 w-32" />
              </div>
            </div>
            <Skeleton className="mt-5 h-10 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
