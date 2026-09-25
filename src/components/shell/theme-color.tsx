"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// The browser bar and, in the installed app, the status bar take the colour
// of what is right under them: the app bar in the private space, the deep
// green header of the home page, the page background elsewhere. Follows the theme
// and contrast chosen in Classéo, not only the system setting.
export function ThemeColor() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const token = pathname === "/" ? "--sidebar" : pathname.startsWith("/espace") ? "--surface" : "--bg";
    const apply = () => {
      const color = getComputedStyle(root).getPropertyValue(token).trim();
      if (!color) return;
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.content = color;
      });
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-contrast"] });
    return () => mo.disconnect();
  }, [pathname]);

  return null;
}
