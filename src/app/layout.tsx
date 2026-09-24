import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque } from "next/font/google";

import { Toaster } from "@/components/kit/toaster";

import "./globals.css";

// Atkinson Hyperlegible was designed with the Braille Institute for readers
// with low vision: distinct letterforms (I, l, 1; O, 0) at every size.
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Classéo, l'école béninoise connectée", template: "%s · Classéo" },
  description:
    "Plateforme nationale inclusive qui relie le ministère, les directions départementales, les écoles, les enseignants, les élèves et les parents du Bénin.",
  applicationName: "Classéo",
  appleWebApp: { capable: true, title: "Classéo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#006b40" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1510" },
  ],
  width: "device-width",
  initialScale: 1,
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
