"use client";

import { FileUp, Paperclip } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type ComponentProps, type Ref } from "react";

import { cn } from "@/lib/utils";

function names(input: HTMLInputElement) {
  return Array.from(input.files ?? []).map((f) => f.name);
}

function assign<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

// File field of the design system: a drop zone the height of two lines,
// with a "Choisir un fichier" button look and the chosen file's name. The
// native input covers the whole zone, transparent: a click, a tap, the
// keyboard (Space or Enter on the focused field) and a file dropped on it
// all go through the browser's own control, which stays the one submitted
// with the form and the one screen readers announce. Its label, id, name
// and ARIA come from FormField like any other control.
export function FileInput({
  className,
  onChange,
  ref,
  placeholder = "Choisir un fichier",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { placeholder?: string }) {
  const own = useRef<HTMLInputElement | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);

  // A form reset empties the input without a change event.
  useEffect(() => {
    const form = own.current?.form;
    if (!form) return;
    const onReset = () => setTimeout(() => setChosen([]));
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  function change(e: ChangeEvent<HTMLInputElement>) {
    setChosen(names(e.currentTarget));
    onChange?.(e);
  }

  const label = chosen.length === 0 ? null : chosen.length === 1 ? chosen[0] : `${chosen.length} fichiers`;

  return (
    <div className={cn("ds-file", className)} data-filled={label ? "" : undefined} data-disabled={props.disabled ? "" : undefined}>
      <span className="ds-file-icon" aria-hidden>
        {label ? <Paperclip /> : <FileUp />}
      </span>
      <span className="min-w-0 flex-1" aria-hidden>
        <span className="block truncate font-semibold text-text">{label ?? placeholder}</span>
        {label ? <span className="block text-hint text-muted">Toucher pour changer de fichier</span> : <span className="block text-hint text-muted max-sm:hidden">ou déposez-le ici</span>}
      </span>
      <input
        ref={(el) => {
          own.current = el;
          assign(ref, el);
        }}
        type="file"
        onChange={change}
        className="ds-file-input"
        {...props}
      />
    </div>
  );
}
