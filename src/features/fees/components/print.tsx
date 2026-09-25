"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden /> {label}
    </Button>
  );
}

// Printable pages hide the application shell (the sticky sidebar and top
// bar of the layout) on paper, not the headers of the page itself.
export function PrintStyles({ landscape = false }: { landscape?: boolean }) {
  return (
    <style>{`@media print {
  body aside.sticky, body header.sticky, [data-print-hide] { display: none !important; }
  body main { max-width: none !important; padding: 0 !important; }
  body { background: #fff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  @page { margin: 10mm;${landscape ? " size: A4 landscape;" : ""} }
}`}</style>
  );
}
