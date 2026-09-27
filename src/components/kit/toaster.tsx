"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

type Toast = { id: number; tone: "success" | "error"; message: string };

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(tone: Toast["tone"], message: string) {
  const id = ++seq;
  toasts = [...toasts, { id, tone, message }];
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const EMPTY: Toast[] = [];

// Visual and screen reader feedback for every action. Errors use an
// assertive region, successes a polite one. A dark card in the light theme
// (the body text colour as background), a light one in the dark theme.
export function Toaster() {
  const list = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 ds-toaster z-50 flex flex-col items-center gap-2 px-3 sm:items-end sm:px-6 print:hidden">
      {(["success", "error"] as const).map((tone) => (
        <div key={tone} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"} className="contents">
          {list
            .filter((t) => t.tone === tone)
            .map((t) => (
              <div
                key={t.id}
                className="ds-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-text bg-text py-3 pr-2 pl-3 text-sm text-surface shadow-overlay"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    tone === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
                  )}
                  aria-hidden
                >
                  {tone === "error" ? <XCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
                </span>
                <p className="flex-1 self-center leading-snug font-medium">{t.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Fermer la notification"
                  className="-my-1 inline-flex size-9 shrink-0 items-center justify-center rounded-control text-surface/80 transition-colors hover:bg-surface/10 hover:text-surface"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
