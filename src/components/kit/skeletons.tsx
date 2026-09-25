import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden />;
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="w-24" />
            <Skeleton className="size-9 rounded-control" />
          </div>
          <Skeleton className="mt-3 h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

// Mirrors the DataTable: a toolbar, then rows as a table from 40rem and as
// cards below, so the page does not jump when the data arrives.
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-border bg-surface shadow-card" aria-hidden>
      <div className="border-b border-border p-3 sm:p-4">
        <Skeleton className="h-11 w-full rounded-control sm:max-w-sm" />
      </div>
      <div className="hidden border-b border-border bg-surface-2 px-4 py-3 sm:flex sm:gap-4">
        <Skeleton className="h-3 w-1/5" />
        <Skeleton className="h-3 w-1/6" />
        <Skeleton className="h-3 w-1/12" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5 border-b border-border px-4 py-4 last:border-0 sm:flex-row sm:items-center sm:gap-4">
          <Skeleton className="w-2/3 sm:w-1/4" />
          <div className="flex justify-between gap-4 sm:contents">
            <Skeleton className="h-3 w-1/4 sm:h-4 sm:w-1/3" />
            <Skeleton className="h-3 w-1/5 sm:h-4 sm:w-1/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement en cours">
      <div>
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="mt-3 w-96 max-w-full" />
      </div>
      <StatsSkeleton />
      <TableSkeleton />
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
