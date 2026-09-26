import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Classéo",
    short_name: "Classéo",
    description: "La plateforme de gestion scolaire pour le Bénin. Lecture à voix haute, pictogrammes, consultation hors ligne.",
    lang: "fr",
    dir: "ltr",
    start_url: "/espace",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // Splash screen: the logo on the deep green of the sidebar, status bar in
    // the same colour until the page sets its own (see ThemeColor).
    background_color: "#0b3b2a",
    theme_color: "#0b3b2a",
    prefer_related_applications: false,
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    // Pages every account may open (a family entry would refuse a teacher).
    shortcuts: [
      { name: "Notifications", short_name: "Notifications", url: "/espace/notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Guide d'utilisation", short_name: "Aide", url: "/espace/aide", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
