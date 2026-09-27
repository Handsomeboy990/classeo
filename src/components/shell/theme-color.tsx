"use client";

import { useEffect } from "react";

// The browser bar and, in the installed app, the status bar take the navy of
// the bar right under them (design source of truth, 2.6): the app bar of the
// private space, the band and main bar of the public pages, the sign in bar
// on a phone. One colour everywhere, --header: #0A3764 in the light theme,
// #0D2440 in the dark one. Follows the theme and contrast chosen in Classéo,
// never the system setting.
export function ThemeColor() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const color = getComputedStyle(root).getPropertyValue("--header").trim();
      if (!color) return;
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.content = color;
      });
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-contrast"] });
    return () => mo.disconnect();
  }, []);

  return null;
}
