"use client";

import { BellRing, Loader2, Send } from "lucide-react";
import { useId, useTransition } from "react";

import { toast } from "@/components/kit/toaster";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { sendTestPush } from "./actions";
import { disablePush, enablePush, usePushStatus } from "./device";

const DESCRIPTIONS: Record<string, string> = {
  on: "Activées. Absences, bulletins et messages arrivent même quand Classéo est fermé.",
  off: "Recevez les alertes importantes même quand Classéo est fermé.",
  busy: "Un instant…",
  denied: "Bloquées pour ce site. Autorisez les notifications dans les réglages du navigateur, puis revenez ici.",
};

// "Notifications sur cet appareil". Hidden when push is not configured on
// the server (no VAPID key) or not available in this browser.
// With explain, a browser without push says so instead of showing nothing.
export function PushToggle({ publicKey, className, explain = false }: { publicKey: string | null; className?: string; explain?: boolean }) {
  const status = usePushStatus(!!publicKey);
  const [testing, startTest] = useTransition();
  const titleId = useId();
  const descId = useId();

  if (!publicKey) return null;
  if (status === "unknown") return explain ? <div className={cn("min-h-14", className)} aria-hidden /> : null;
  if (status === "unsupported") {
    return explain ? <p className={cn("px-3 py-3 text-sm text-muted", className)}>Ce navigateur ne peut pas recevoir les notifications de Classéo.</p> : null;
  }

  if (status === "ios-install") {
    return (
      <div className={cn("flex items-start gap-3 px-3 py-3", className)}>
        <BellRing className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
        <p className="text-sm text-muted">
          <span className="block font-semibold text-text">Notifications sur cet appareil</span>
          Sur iPhone, elles arrivent une fois Classéo ajouté à l&apos;écran d&apos;accueil. Ouvrez ensuite l&apos;application depuis son icône.
        </p>
      </div>
    );
  }

  const on = status === "on";
  const busy = status === "busy";

  async function toggle() {
    const result = on ? await disablePush() : await enablePush(publicKey!);
    if (result.message) toast(result.ok ? "success" : "error", result.message);
  }

  function test() {
    startTest(async () => {
      const result = await sendTestPush(null, {});
      if (result?.message) toast(result.ok ? "success" : "error", result.message);
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={titleId}
        aria-describedby={descId}
        disabled={busy || status === "denied"}
        onClick={toggle}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-2 active:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <BellRing className="size-5 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span id={titleId} className="block font-semibold">
            Notifications sur cet appareil
          </span>
          <span id={descId} className="block text-sm text-muted">
            {DESCRIPTIONS[status]}
          </span>
        </span>
        {/* Off: outlined track and a small knob; on: filled track. Both reach 3:1. */}
        <span
          aria-hidden
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-150",
            on ? "border-primary bg-primary" : "border-muted bg-surface",
            status === "denied" && "opacity-50",
          )}
        >
          {busy ? (
            <Loader2 className="mx-auto size-4 animate-spin text-muted" />
          ) : (
            <span
              className={cn(
                "absolute rounded-full transition-[left,width,height] duration-150",
                on ? "left-[1.375rem] size-5 bg-on-primary" : "left-1 size-3.5 bg-muted",
              )}
            />
          )}
        </span>
      </button>
      {on && (
        <div className="px-3 pb-2">
          <Button type="button" variant="secondary" loading={testing} onClick={test} className="w-full sm:w-auto">
            {!testing && <Send aria-hidden />}
            Envoyer une notification d&apos;essai
          </Button>
        </div>
      )}
    </div>
  );
}
