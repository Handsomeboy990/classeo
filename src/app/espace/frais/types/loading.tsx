import { Skeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement des types de frais">
      <Skeleton className="h-8 w-80 max-w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-card" />
        ))}
      </div>
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
