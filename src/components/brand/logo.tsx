import { cn } from "@/lib/utils";

// Classeo mark: an open book from which the sun rises, in the colours of the
// Benin flag (green field, yellow sun, red bookmark).
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-9 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="64" height="64" rx="14" fill="#006B40" />
      <path d="M20 37a12 12 0 0 1 24 0z" fill="#FCD116" />
      <g stroke="#FCD116" strokeWidth="3" strokeLinecap="round">
        <path d="M32 14v5" />
        <path d="M17.5 20l3.5 3.5" />
        <path d="M46.5 20L43 23.5" />
      </g>
      <path d="M8 38c8-4 16-4 24 2v14c-8-6-16-6-24-2z" fill="#FFFFFF" />
      <path d="M56 38c-8-4-16-4-24 2v14c8-6 16-6 24-2z" fill="#F0F1EA" />
      <path d="M30.5 40h3v17l-1.5-2-1.5 2z" fill="#E8112D" />
    </svg>
  );
}

export function Logo({ className, tone = "default" }: { className?: string; tone?: "default" | "inverse" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-display text-xl font-bold tracking-tight",
          tone === "inverse" ? "text-sidebar-text" : "text-text",
        )}
      >
        Classéo
      </span>
    </span>
  );
}
