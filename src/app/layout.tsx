import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Montserrat } from "next/font/google";

import { Toaster } from "@/components/kit/toaster";
import { AccessibilityFab } from "@/components/shell/accessibility-fab";
import { ThemeColor } from "@/components/shell/theme-color";
import { OfflineBanner } from "@/features/pwa/offline-banner";
import { ServiceWorkerRegistration } from "@/features/pwa/service-worker";

import "./globals.css";

// Atkinson Hyperlegible was designed with the Braille Institute for readers
// with low vision: distinct letterforms (I, l, 1; O, 0) at every size.
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-body", display: "swap" });
// Montserrat, the typeface of the Beninese State sites, for headings,
// navigation, buttons and the brand lockup (weights 500 to 800). The
// variable font: one file per subset for every weight. latin-ext covers the
// accented letters of the national languages. Self-hosted by Next.js at
// build time, no request to Google at run time.
const display = Montserrat({ subsets: ["latin", "latin-ext"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Classéo · Le système éducatif, à portée de main", template: "%s · Classéo" },
  description:
    "Classéo, la plateforme de gestion scolaire pour le Bénin : inscriptions, notes, bulletins, présences, frais et messages, accessibles à tous, même hors ligne.",
  applicationName: "Classéo",
  appleWebApp: { capable: true, title: "Classéo", statusBarStyle: "default" },
  // The manifest link comes from app/manifest.ts, the icons from icon.svg,
  // apple-icon.tsx and opengraph-image.tsx.
  openGraph: { type: "website", locale: "fr_BJ", siteName: "Classéo" },
  formatDetection: { telephone: false },
};

// The first paint uses the app bar surface of each system theme; ThemeColor
// then follows the page and the theme chosen in Classéo. viewportFit cover
// exposes the safe areas (home indicator, notch) the shell pads for.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161d19" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applied before the first paint so the chosen theme, contrast and text size
// never flash. Values come from this device only.
const preferencesScript = `(function(){try{var d=document.documentElement,s=localStorage;var t=s.getItem("classeo:theme")||"system";if(t==="system"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t;d.dataset.contrast=s.getItem("classeo:contrast")||"normal";d.dataset.text=s.getItem("classeo:text")||"md";d.dataset.lite=s.getItem("classeo:lite")||"off"}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${body.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferencesScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#page-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          Aller au contenu principal
        </a>
        <OfflineBanner />
        {children}
        <AccessibilityFab />
        <Toaster />
        <ServiceWorkerRegistration />
        <ThemeColor />
      </body>
    </html>
  );
}
