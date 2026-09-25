"use client";

import { useEffect, useRef } from "react";

import { useFormState } from "@/components/kit/action-form";

// Placed inside an ActionForm: after a failed submit, moves focus to the
// first invalid field so keyboard and screen reader users land on it.
export function FocusFirstError() {
  const state = useFormState();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!state || state.ok || !state.fieldErrors) return;
    const form = ref.current?.closest("form");
    const target = form?.querySelector<HTMLElement>("[aria-invalid='true']");
    target?.focus();
  }, [state]);
  return <span ref={ref} hidden />;
}
