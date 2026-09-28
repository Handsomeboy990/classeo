import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Montserrat } from "next/font/google";

import { Toaster } from "@/components/kit/toaster";
import { AccessibilityFab } from "@/components/shell/accessibility-fab";
import { ThemeColor } from "@/components/shell/theme-color";
import { VisitBeacon } from "@/features/connections/visit-beacon";
import { OfflineBanner } from "@/features/pwa/offline-banner";
import { ServiceWorkerRegistration } from "@/features/pwa/service-worker";
import { siteUrl } from "@/lib/seo";

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
  // The public address with the same fallbacks as the canonical addresses
  // (APP_URL, NEXT_PUBLIC_APP_URL, then the Vercel production address), so
  // a page without its own metadata, the 404 for one, never shares a
  // localhost image.
  metadataBase: new URL(siteUrl()),
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

// The first paint uses the institutional navy, whatever the system theme;
// ThemeColor then follows the page and the theme chosen in Classéo. viewportFit cover
// exposes the safe areas (home indicator, notch) the shell pads for.
export const viewport: Viewport = {
  themeColor: "#0a3764",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applied before the first paint so the chosen theme, contrast and text size
// never flash. Values come from this device only. The light, official look
// is the default on every device, whatever the system colour scheme: the
// dark theme only applies when chosen in the accessibility panel.
const preferencesScript = `(function(){try{var d=document.documentElement,s=localStorage;d.dataset.theme=s.getItem("classeo:theme")==="dark"?"dark":"light";d.dataset.contrast=s.getItem("classeo:contrast")||"normal";d.dataset.text=s.getItem("classeo:text")||"md";d.dataset.lite=s.getItem("classeo:lite")||"off"}catch(e){}})();`;

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
        <VisitBeacon />
      </body>
    </html>
  );
}
