import { Skeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-label="Chargement de la facture" className="flex flex-col gap-6">
      <Skeleton className="h-9 w-60" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
