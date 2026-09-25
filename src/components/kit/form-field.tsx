"use client";

import { CircleAlert } from "lucide-react";
import { useId, type ReactElement, cloneElement } from "react";

import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useFormState } from "./action-form";

// Label, control, hint and server side error, wired for screen readers.
// The control is passed as the only child and receives id, name and ARIA.
export function FormField({
  label,
  name,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
}) {
  const id = useId();
  const state = useFormState();
  const error = state?.fieldErrors?.[name]?.[0];
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        )}
      </Label>
      {cloneElement(children, {
        id,
        name,
        required,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-hint text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm leading-snug font-semibold text-danger">
          <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
