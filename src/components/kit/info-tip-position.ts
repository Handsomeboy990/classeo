// Placement of an info bubble (kit/info-tip.tsx), kept pure so it can be
// tested without a browser. The bubble prefers the space above its button,
// flips below when there is not enough room there, and slides sideways so
// it never leaves the window: at 200 % zoom or on a 320 px phone it stays
// whole, with its arrow still pointing at the button.

export type Rect = { top: number; left: number; width: number; height: number };
export type TipPlacement = { top: number; left: number; side: "top" | "bottom"; arrow: number };

export const TIP_GAP = 8;
export const TIP_MARGIN = 8;

export function tipPosition(anchor: Rect, tip: { width: number; height: number }, viewport: { width: number; height: number }): TipPlacement {
  const width = Math.min(tip.width, viewport.width - TIP_MARGIN * 2);
  const above = anchor.top - TIP_GAP - TIP_MARGIN;
  const below = viewport.height - (anchor.top + anchor.height) - TIP_GAP - TIP_MARGIN;
  const side = tip.height <= above || above >= below ? "top" : "bottom";
  const centre = anchor.left + anchor.width / 2;
  const left = Math.round(Math.min(Math.max(TIP_MARGIN, centre - width / 2), viewport.width - TIP_MARGIN - width));
  const top = Math.round(side === "top" ? Math.max(TIP_MARGIN, anchor.top - TIP_GAP - tip.height) : anchor.top + anchor.height + TIP_GAP);
  // The arrow follows the button, kept off the rounded corners.
  const arrow = Math.round(Math.min(Math.max(12, centre - left), width - 12));
  return { top, left, side, arrow };
}
