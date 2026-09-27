import { cn } from "@/lib/utils";

// Classeo mark: an open book from which the sun rises, on the institutional
// navy, with the flag yellow sun and red bookmark.
//
// tone "dark" is the mark placed on a navy surface (public header, sidebar,
// app bar): no tile, the book drawn in white straight on the surface, so the
// mark keeps its silhouette without a light square around it.
export function LogoMark({ className, title, tone = "light" }: { className?: string; title?: string; tone?: "light" | "dark" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-9 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {tone === "light" && <rect width="64" height="64" rx="14" fill="var(--header)" />}
      <path d="M20 37a12 12 0 0 1 24 0z" fill="var(--flag-yellow)" />
      <g stroke="var(--flag-yellow)" strokeWidth="3" strokeLinecap="round">
        <path d="M32 14v5" />
        <path d="M17.5 20l3.5 3.5" />
        <path d="M46.5 20L43 23.5" />
      </g>
      <path d="M8 38c8-4 16-4 24 2v14c-8-6-16-6-24-2z" fill="var(--header-text)" />
      <path d="M56 38c-8-4-16-4-24 2v14c8-6 16-6 24-2z" fill="var(--header-text)" fillOpacity="0.86" />
      <path d="M30.5 40h3v17l-1.5-2-1.5 2z" fill="var(--flag-red)" />
    </svg>
  );
}

export function Logo({ className, tone = "default" }: { className?: string; tone?: "default" | "inverse" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-display text-xl font-extrabold tracking-[0.01em]",
          tone === "inverse" ? "text-sidebar-text" : "text-primary",
        )}
        translate="no"
      >
        Classéo
      </span>
    </span>
  );
}
