"use client";

import { CircleAlert } from "lucide-react";

import { useFormState } from "@/components/kit/action-form";

// The server message of a field that is not a single control (a group of
// radios), under its fieldset.
export function FieldError({ name }: { name: string }) {
  const error = useFormState()?.fieldErrors?.[name]?.[0];
  if (!error) return null;
  return (
    <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-danger">
      <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
      <span>{error}</span>
    </p>
  );
}
