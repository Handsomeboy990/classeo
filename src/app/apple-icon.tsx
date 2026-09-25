import { ImageResponse } from "next/og";

import { squareMark } from "@/features/pwa/brand-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies its own rounded mask: the icon is full bleed.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={squareMark} width={180} height={180} />
      </div>
    ),
    size,
  );
}
