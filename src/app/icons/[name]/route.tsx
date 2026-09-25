import { ImageResponse } from "next/og";

import { roundedMark, squareMark } from "@/features/pwa/brand-art";

// PWA icons generated from the logo at build time: /icons/icon-192.png,
// /icons/icon-512.png and /icons/maskable-512.png.
const ICONS = {
  "icon-192.png": { size: 192, src: roundedMark },
  "icon-512.png": { size: 512, src: roundedMark },
  "maskable-512.png": { size: 512, src: squareMark },
} as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, ctx: RouteContext<"/icons/[name]">) {
  const { name } = await ctx.params;
  const icon = ICONS[name as keyof typeof ICONS];
  if (!icon) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={icon.src} width={icon.size} height={icon.size} />
      </div>
    ),
    { width: icon.size, height: icon.size, headers: { "Cache-Control": "public, max-age=86400, immutable" } },
  );
}
