import { cn } from "@/lib/utils";

// Flag of the Republic of Benin, 3:2: a green vertical band on the hoist
// side (two fifths of the width), yellow over red horizontal bands on the
// rest. Decorative: the name written next to it carries the meaning.
export function BeninFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 15 10" className={cn("h-5 w-auto shrink-0 rounded-[2px]", className)} aria-hidden focusable="false">
      <rect width="6" height="10" fill="#008751" />
      <rect x="6" width="9" height="5" fill="#FCD116" />
      <rect x="6" y="5" width="9" height="5" fill="#E8112D" />
      {/* A hairline so the yellow never melts into a light surface. */}
      <rect x="0.15" y="0.15" width="14.7" height="9.7" fill="none" stroke="rgb(0 0 0 / 0.14)" strokeWidth="0.3" rx="0.3" />
    </svg>
  );
}
