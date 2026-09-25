import { FileDown } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// "Télécharger en PDF": a plain link to a PDF route, so the browser
// downloads the file (the route answers with an attachment). Shown by the
// pages only when the account holds the route's permission; the route
// checks it again, with the scope.
export function PdfDownloadLink({
  href,
  label = "Télécharger en PDF",
  description,
  size = "md",
  variant = "secondary",
  className,
}: {
  href: string;
  label?: string;
  // Spoken by screen readers when several PDF links share a page.
  description?: string;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost";
  className?: string;
}) {
  return (
    <a
      href={href}
      download
      data-print-hide
      aria-label={description ? `${label}, ${description}` : undefined}
      className={cn(buttonVariants({ variant, size }), "print:hidden", className)}
    >
      <FileDown aria-hidden /> {label}
    </a>
  );
}
