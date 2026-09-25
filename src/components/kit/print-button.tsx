"use client";

import { Printer } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

// Opens the print dialog. Never printed itself; the page layout on paper
// comes from the shared print stylesheet (globals.css).
export function PrintButton({
  label = "Imprimer",
  variant = "secondary",
  size,
}: {
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
}) {
  return (
    <Button type="button" variant={variant} size={size} onClick={() => window.print()} data-print-hide className="print:hidden">
      <Printer aria-hidden />
      {label}
    </Button>
  );
}
