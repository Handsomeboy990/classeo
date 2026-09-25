import { Skeleton } from "@/components/kit/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-label="Chargement du paiement" className="flex flex-col gap-6">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-14 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
