import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Classéo",
    short_name: "Classéo",
    description: "Plateforme nationale inclusive de l'éducation au Bénin. Lecture à voix haute, pictogrammes, consultation hors ligne.",
    lang: "fr",
    dir: "ltr",
    start_url: "/espace",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b3b2a",
    theme_color: "#006b40",
    categories: ["education", "government"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Suivi scolaire", short_name: "Suivi", url: "/espace/suivi", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Guide d'utilisation", short_name: "Aide", url: "/espace/aide", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
