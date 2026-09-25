"use client";

import { useEffect, useRef } from "react";

import { useFormState } from "@/components/kit/action-form";

// Placed inside an ActionForm, runs after every server answer.
// - React resets a form once its action settles; controlled inputs and
//   textareas survive it, but native selects fall back to their first option.
//   The values passed in `selects` are written back so a refused submission
//   keeps every choice.
// - After a refusal, the focus moves to the first invalid field so keyboard
//   and screen reader users land on the problem instead of hunting for it.
export function FormRecovery({ selects = {} }: { selects?: Record<string, string> }) {
  const state = useFormState();
  const marker = useRef<HTMLSpanElement>(null);
  const latest = useRef(selects);
  useEffect(() => {
    latest.current = selects;
  });
  useEffect(() => {
    if (!state) return;
    const form = marker.current?.closest("form");
    if (!form) return;
    for (const [name, value] of Object.entries(latest.current)) {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLSelectElement && el.value !== value) el.value = value;
    }
    if (state.ok || !state.fieldErrors) return;
    form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [state]);
  return <span ref={marker} hidden />;
}
