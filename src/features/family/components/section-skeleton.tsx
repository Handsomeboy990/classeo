import { Skeleton } from "@/components/kit/skeletons";

// Loading state of one section of a student file: summary, then content.
export function SectionSkeleton({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label={label}>
      <Skeleton className="h-20 w-full rounded-card" />
      <div className="rounded-card border border-border bg-surface">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0">
            <Skeleton className="w-1/3" />
            <Skeleton className="w-1/5" />
            <Skeleton className="ml-auto h-7 w-28 rounded-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
