import { cn, initials } from "@/lib/utils";

// A pupil's photo, or their initials when the school has not added one.
// The initials stay underneath: in light data mode the photo is not
// downloaded (decorative image) and the initials show instead. The name is
// always written next to it, so the image carries no text alternative.
export function StudentAvatar({ name, photoFileId, className }: { name: string; photoFileId?: string | null; className?: string }) {
  // Same address as fileUrl() in lib/files.ts, which is server only.
  const src = photoFileId ? `/api/files/${photoFileId}` : null;
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-sm font-bold text-primary", className)}
    >
      {initials(name)}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" data-decorative loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}
