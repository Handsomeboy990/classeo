"use client";

import { useEffect, useRef } from "react";

import { useFormState } from "@/components/kit/action-form";

// Placed inside an ActionForm: after a failed submit, moves the focus to the
// first field the server rejected, so keyboard and screen reader users land
// on the problem.
export function FocusFirstInvalid() {
  const state = useFormState();
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!state || state.ok || !state.fieldErrors) return;
    const form = marker.current?.closest("form");
    const first = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
  }, [state]);
  return <span ref={marker} hidden />;
}
