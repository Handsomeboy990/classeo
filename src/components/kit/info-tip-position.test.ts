import { describe, expect, it } from "vitest";

import { TIP_MARGIN, tipPosition } from "./info-tip-position";

const viewport = { width: 390, height: 844 };
const tip = { width: 280, height: 90 };

describe("tipPosition", () => {
  it("prefers the space above the button, centred on it", () => {
    const p = tipPosition({ top: 400, left: 180, width: 24, height: 24 }, tip, viewport);
    expect(p.side).toBe("top");
    expect(p.top).toBe(400 - 8 - 90);
    expect(p.left).toBe(Math.round(192 - 140));
    expect(p.arrow).toBe(140);
  });

  it("flips below when the top of the window is too close", () => {
    const p = tipPosition({ top: 20, left: 180, width: 24, height: 24 }, tip, viewport);
    expect(p.side).toBe("bottom");
    expect(p.top).toBe(20 + 24 + 8);
  });

  it("slides inside the window next to the left and right edges", () => {
    const left = tipPosition({ top: 400, left: 2, width: 24, height: 24 }, tip, viewport);
    expect(left.left).toBe(TIP_MARGIN);
    expect(left.arrow).toBeGreaterThanOrEqual(12);
    const right = tipPosition({ top: 400, left: 370, width: 24, height: 24 }, tip, viewport);
    expect(right.left + tip.width).toBeLessThanOrEqual(viewport.width - TIP_MARGIN);
    expect(right.arrow).toBeLessThanOrEqual(tip.width - 12);
  });

  it("never gets wider than a narrow window", () => {
    const p = tipPosition({ top: 400, left: 150, width: 24, height: 24 }, { width: 500, height: 90 }, { width: 320, height: 640 });
    expect(p.left).toBe(TIP_MARGIN);
  });
});
