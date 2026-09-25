import { Skeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l'emploi du temps">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 w-80 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full max-w-md" />
      <Skeleton className="h-[32rem] w-full rounded-card" />
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}
