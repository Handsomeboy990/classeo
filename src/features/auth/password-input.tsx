"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";

// A password field with a button that shows what was typed, for a person
// unsure of a temporary password read from a paper slip. The field receives
// id, name and ARIA from FormField; the button keeps one name and says its
// state with aria-pressed.
export function PasswordInput({ showLabel, hideLabel, ...props }: Omit<ComponentProps<"input">, "type"> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={showLabel}
        aria-pressed={visible}
        aria-controls={props.id}
        title={visible ? hideLabel : showLabel}
        className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center rounded-r-control text-muted hover:text-text"
      >
        {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}
