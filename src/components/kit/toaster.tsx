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
// assertive region, successes a polite one.
export function Toaster() {
  const list = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
      {(["success", "error"] as const).map((tone) => (
        <div key={tone} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"} className="contents">
          {list
            .filter((t) => t.tone === tone)
            .map((t) => (
              <div
                key={t.id}
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-lg",
                  tone === "error" ? "border-danger" : "border-primary",
                )}
              >
                {tone === "error" ? (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
                ) : (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                )}
                <p className="flex-1 text-text">{t.message}</p>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Fermer la notification" className="text-muted hover:text-text">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
