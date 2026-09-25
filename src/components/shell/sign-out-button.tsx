"use client";

import { useRef, type ReactNode } from "react";

import { logout } from "@/features/auth/actions";
import { releaseDevice } from "@/features/push/device";

// Signing out first detaches this device from the user's push
// notifications (a phone is often shared in a family), then ends the
// session. Without JavaScript the form still signs out.
export function SignOutButton({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const released = useRef(false);

  return (
    <form
      ref={form}
      action={logout}
      onSubmit={(e) => {
        if (released.current) return;
        e.preventDefault();
        void releaseDevice().finally(() => {
          released.current = true;
          form.current?.requestSubmit();
        });
      }}
    >
      <button type="submit" className={className} aria-label={label} title={label}>
        {children}
      </button>
    </form>
  );
}
