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

// Printable pages hide the application shell (sidebar, top bar) on paper.
export function PrintStyles() {
  return (
    <style>{`@media print {
  body aside, body header, [data-print-hide] { display: none !important; }
  body main { max-width: none !important; padding: 0 !important; }
  body { background: #fff !important; }
  @page { margin: 12mm; }
}`}</style>
  );
}
