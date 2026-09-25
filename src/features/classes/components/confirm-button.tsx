"use client";

import type { ComponentProps, ReactNode } from "react";

import { ConfirmAction } from "@/components/kit/confirm-action";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action";

// ConfirmAction with a plain button trigger, usable from server components
// (which cannot pass the render function ConfirmAction expects).
export function ConfirmButton({
  children,
  variant = "danger",
  size = "md",
  label,
  tone = "danger",
  ...props
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  children: ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  // Accessible name when the trigger shows an icon only.
  label?: string;
}) {
  return (
    <ConfirmAction
      {...props}
      tone={tone}
      trigger={(open) => (
        <Button type="button" variant={variant} size={size} onClick={open} aria-label={label} title={label}>
          {children}
        </Button>
      )}
    />
  );
}
