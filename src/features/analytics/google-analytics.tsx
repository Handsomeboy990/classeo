"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

import { CONSENT_KEY, gaCookieNames, gaPagePath, mayAsk, mayLoad, readConsent, type Consent } from "./consent";

type Texts = { text: string; accept: string; decline: string; withdraw: string };
type GaWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
type PrivacyNavigator = Navigator & { globalPrivacyControl?: boolean };

// The queue gtag.js reads once loaded. It must receive the arguments
// object itself, as Google's snippet does; no inline script is needed.
function defineGtag(w: GaWindow) {
  w.dataLayer = w.dataLayer ?? [];
  w.gtag =
    w.gtag ??
    function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  return w.gtag;
}

// The choice lives in localStorage; a memory copy covers a browser without
// storage. Components re-read it when it changes, here or in another tab.
let memory: Consent | null = null;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
const snapshot = (): Consent | "none" => readConsent(window.localStorage) ?? memory ?? "none";
// The server never knows the choice: nothing shows until hydration.
const serverSnapshot = () => "unknown" as const;

function store(value: Consent) {
  memory = value;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Private browsing without storage: the memory copy is enough.
  }
  listeners.forEach((l) => l());
}

// Optional Google Analytics of the public pages (features/analytics/consent.ts):
// a small banner asks first; gtag.js loads only after "Accepter", never on
// the signed in space, never for a browser that asks not to be followed.
// Once accepted, the same place offers to withdraw the consent.
export function GoogleAnalytics({ gaId, texts, lang }: { gaId: string; texts: Texts; lang: string }) {
  const pathname = usePathname();
  const stored = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const consent = stored === "none" ? null : stored;

  const nav = typeof navigator === "undefined" ? undefined : (navigator as PrivacyNavigator);
  const load = consent !== "unknown" && mayLoad({ gaId, pathname, nav, consent });

  useEffect(() => {
    if (!load) return;
    const gtag = defineGtag(window as GaWindow);
    gtag("event", "page_view", { page_location: `${window.location.origin}${gaPagePath(pathname)}`, page_path: gaPagePath(pathname) });
  }, [load, pathname]);

  if (consent === "unknown" || !mayAsk({ gaId, pathname, nav })) return null;

  function withdraw() {
    store("denied");
    // Google's cookies go too, on this host and its parent domain.
    const host = window.location.hostname;
    for (const name of gaCookieNames(document.cookie)) {
      for (const domain of ["", `; domain=${host}`, `; domain=.${host.split(".").slice(-2).join(".")}`]) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
      }
    }
    window.location.reload();
  }

  if (consent === "granted") {
    return (
      <>
        <Script
          id="ga-loader"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
          strategy="afterInteractive"
          onReady={() => {
            const gtag = defineGtag(window as GaWindow);
            gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
            gtag("js", new Date());
            // Page views are sent by the effect above, with the path cleaned.
            gtag("config", gaId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
          }}
        />
        <div lang={lang} className="mx-auto max-w-7xl px-4 pb-4 sm:px-8">
          <button type="button" onClick={withdraw} className="min-h-11 text-xs text-muted underline underline-offset-4">
            {texts.withdraw}
          </button>
        </div>
      </>
    );
  }
  if (consent === "denied") return null;
  return (
    <div role="region" aria-label="Mesure d'audience" lang={lang} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-card border border-border bg-surface p-4 shadow-raised sm:bottom-5">
      <p className="text-sm leading-relaxed text-text">{texts.text}</p>
      <div className="mt-3 flex gap-2 max-sm:*:flex-1">
        <Button type="button" variant="secondary" onClick={() => store("denied")}>
          {texts.decline}
        </Button>
        <Button type="button" onClick={() => store("granted")}>
          {texts.accept}
        </Button>
      </div>
    </div>
  );
}
