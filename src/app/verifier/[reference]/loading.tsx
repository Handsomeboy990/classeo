import { Skeleton } from "@/components/kit/skeletons";
import { PublicShell } from "@/features/verification/components/public-shell";

export default function Loading() {
  return (
    <PublicShell>
      <div role="status" aria-label="Vérification en cours" className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </PublicShell>
  );
}
