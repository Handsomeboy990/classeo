import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Table primitives. Spacing, header and row styles live in globals.css
// (.ds-table) so the density option and the phone card layout apply to the
// cells without every page repeating classes; a className still wins.
export function Table({
  className,
  density = "comfortable",
  sticky = false,
  striped = false,
  cards = false,
  wrapperClassName,
  ...props
}: ComponentProps<"table"> & {
  density?: "comfortable" | "compact";
  // Header stays in view while the page scrolls (large screens).
  sticky?: boolean;
  striped?: boolean;
  // On a phone, each row becomes a card of label and value pairs. Cells need
  // data-label (DataTable sets it from the column headers).
  cards?: boolean;
  wrapperClassName?: string;
}) {
  return (
    // relative: screen reader only text inside cells is positioned against
    // the frame, so it never widens the page when the table scrolls.
    <div className={cn("ds-table-scroll relative w-full overflow-x-auto", sticky && "lg:overflow-x-visible", wrapperClassName)} data-sticky={sticky || undefined}>
      <table
        className={cn("ds-table w-full border-collapse text-sm", className)}
        data-density={density === "compact" ? "compact" : undefined}
        data-sticky={sticky || undefined}
        data-striped={striped || undefined}
        data-cards={cards || undefined}
        {...props}
      />
    </div>
  );
}
export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("text-left", className)} {...props} />;
}
export function TH({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={className} {...props} />;
}
export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={className} {...props} />;
}
export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={className} {...props} />;
}
