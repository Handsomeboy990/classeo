import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden />;
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-card border border-border bg-surface p-5">
          <Skeleton className="w-24" />
          <Skeleton className="mt-3 h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-border bg-surface">
      <div className="border-b border-border p-4">
        <Skeleton className="h-10 w-full max-w-sm" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
          <Skeleton className="w-1/4" />
          <Skeleton className="w-1/3" />
          <Skeleton className="w-1/6" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement en cours">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 w-96 max-w-full" />
      </div>
      <StatsSkeleton />
      <TableSkeleton />
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
