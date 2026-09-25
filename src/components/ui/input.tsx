import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SelectField } from "./select";

// Form controls. The look lives in globals.css (.ds-field, .ds-check,
// .ds-switch): tokens drive light, dark and high contrast alike, and a
// utility class passed through className still wins over it.

export type FieldSize = "sm" | "md" | "lg";

type Adornments = {
  // An icon or a short text drawn inside the field, before the value.
  leading?: ReactNode;
  // A unit or an icon after the value, e.g. "FCFA".
  trailing?: ReactNode;
  // Classes of the wrapper, only rendered when the field is adorned. The
  // className prop always reaches the control itself.
  wrapperClassName?: string;
};

function Adorned({ leading, trailing, wrapperClassName, children }: Adornments & { children: ReactNode }) {
  if (leading == null && trailing == null) return <>{children}</>;
  // A text suffix reserves room for its own length; an icon needs less.
  const endPad = typeof trailing === "string" ? `${Math.min(8, 1.5 + trailing.length * 0.6)}rem` : "2.625rem";
  return (
    <div
      className={cn("ds-adorned", wrapperClassName)}
      data-start={leading != null ? "" : undefined}
      data-end={trailing != null ? "" : undefined}
      style={{ "--end-pad": endPad } as CSSProperties}
    >
      {leading != null && (
        <span className="ds-adornment" data-side="start" aria-hidden>
          {leading}
        </span>
      )}
      {children}
      {trailing != null && (
        <span className="ds-adornment" data-side="end" aria-hidden={typeof trailing === "string" ? undefined : true}>
          {trailing}
        </span>
      )}
    </div>
  );
}

export function Input({
  className,
  fieldSize = "md",
  leading,
  trailing,
  wrapperClassName,
  ...props
}: ComponentProps<"input"> & Adornments & { fieldSize?: FieldSize }) {
  return (
    <Adorned leading={leading} trailing={trailing} wrapperClassName={wrapperClassName}>
      <input className={cn("ds-field", className)} data-size={fieldSize === "md" ? undefined : fieldSize} {...props} />
    </Adorned>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn("ds-field", className)} {...props} />;
}

// Select: native up to five options (lightest, the system picker opens on a
// phone), searchable from six (see ui/select.tsx), with the same API either
// way. searchable forces the search field on a short list.
export function Select(props: ComponentProps<"select"> & { fieldSize?: FieldSize; searchable?: boolean }) {
  return <SelectField {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-semibold text-text", className)} {...props} />;
}

type ChoiceProps = Omit<ComponentProps<"input">, "type"> & {
  // Visible label. Without it, give the control an aria-label.
  label?: ReactNode;
  description?: ReactNode;
  labelClassName?: string;
};

function Choice({ type, label, description, className, labelClassName, role, ...props }: ChoiceProps & { type: "checkbox" | "radio"; role?: string }) {
  const control = <input type={type} role={role} className={cn(role === "switch" ? "ds-switch" : "ds-check", className)} {...props} />;
  if (label == null) return control;
  return (
    <label className={cn("ds-choice", labelClassName)}>
      {control}
      <span className="min-w-0">
        <span className="block text-sm leading-snug font-semibold text-text">{label}</span>
        {description && <span className="mt-0.5 block text-sm leading-snug text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Checkbox(props: ChoiceProps) {
  return <Choice type="checkbox" {...props} />;
}

export function Radio(props: ChoiceProps) {
  return <Choice type="radio" {...props} />;
}

// An on or off setting that applies as a whole (not a list choice). A native
// checkbox with role="switch", so it submits with the form like any other.
export function Switch(props: ChoiceProps) {
  return <Choice type="checkbox" role="switch" {...props} />;
}

// A group of checkboxes or radios under one question.
export function ChoiceGroup({
  legend,
  hint,
  children,
  orientation = "vertical",
  className,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="text-sm font-semibold text-text">{legend}</legend>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className={cn("mt-1.5 flex", orientation === "horizontal" ? "flex-wrap gap-x-6" : "flex-col")}>{children}</div>
    </fieldset>
  );
}
