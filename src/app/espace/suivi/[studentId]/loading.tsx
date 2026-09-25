import { SectionSkeleton } from "@/features/family/components/section-skeleton";

export default function Loading() {
  return <SectionSkeleton label="Chargement du bulletin" rows={8} />;
}
