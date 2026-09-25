"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { ComboboxCore, type ComboOption } from "./combobox";
import { supportsPopover } from "./popover-position";

// Up to this many choices the native select stays: it is the fastest to use
// with a thumb and every assistive technology knows it. Beyond, the list
// becomes searchable.
export const SEARCHABLE_FROM = 6;

type NativeProps = ComponentProps<"select"> & { fieldSize?: "sm" | "md" | "lg"; searchable?: boolean };

function readOptions(select: HTMLSelectElement) {
  const options: ComboOption[] = [];
  let placeholder: string | undefined;
  for (const o of Array.from(select.options)) {
    // A disabled empty option is a prompt ("Choisir un niveau"), not a choice.
    if (o.value === "" && o.disabled) {
      placeholder = o.label;
      continue;
    }
    const parent = o.parentElement;
    options.push({ value: o.value, label: o.label || o.text, disabled: o.disabled, group: parent instanceof HTMLOptGroupElement ? parent.label : undefined });
  }
  return { options, placeholder };
}

const setNativeValue = Object.getOwnPropertyDescriptor(typeof HTMLSelectElement === "undefined" ? Object : HTMLSelectElement.prototype, "value")?.set;

// The kit Select. The native select is always rendered and stays the source
// of truth: it carries the name, the value submitted with the form, the
// defaultValue, form resets and React's onChange. With six options or more
// (or searchable) and a browser that has the Popover API, a searchable
// combobox is drawn over it after hydration and writes back into it. Before
// hydration, without JavaScript or on an old browser, the native select
// simply works.
export function SelectField({ className, fieldSize = "md", searchable, id, children, ...props }: NativeProps) {
  const ref = useRef<HTMLSelectElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [list, setList] = useState<{ options: ComboOption[]; placeholder?: string }>({ options: [] });
  const [value, setValue] = useState("");

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = readOptions(el);
    setList((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    setValue(el.value);
  }, []);

  const multiple = !!props.multiple || (typeof props.size === "number" && props.size > 1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || multiple || !supportsPopover()) return;
    const count = readOptions(el).options.length;
    if (!searchable && count < SEARCHABLE_FROM) return;
    sync();
    setEnhanced(true);
  }, [multiple, searchable, sync]);

  // Options and value follow every re-render of the page (a filtered list,
  // a controlled value, a form reset).
  useEffect(() => {
    const el = ref.current;
    if (!el || !enhanced) return;
    const mo = new MutationObserver(sync);
    mo.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    const onReset = () => setTimeout(sync);
    el.addEventListener("change", sync);
    el.form?.addEventListener("reset", onReset);
    return () => {
      mo.disconnect();
      el.removeEventListener("change", sync);
      el.form?.removeEventListener("reset", onReset);
    };
  }, [enhanced, sync]);
  useEffect(() => {
    if (enhanced) sync();
  });

  function pick(next: string) {
    const el = ref.current;
    if (!el) return;
    setNativeValue?.call(el, next);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    setValue(el.value);
  }

  const {
    "aria-invalid": invalid,
    "aria-describedby": describedBy,
    "aria-label": label,
    "aria-labelledby": labelledBy,
    "aria-busy": busy,
    ...rest
  } = props;

  return (
    <>
      <select
        {...rest}
        ref={ref}
        id={enhanced ? undefined : id}
        className={cn("ds-field", enhanced && "sr-only", className)}
        data-size={fieldSize === "md" ? undefined : fieldSize}
        aria-invalid={enhanced ? undefined : invalid}
        aria-describedby={enhanced ? undefined : describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-busy={busy}
        aria-hidden={enhanced || undefined}
        tabIndex={enhanced ? -1 : props.tabIndex}
        onInvalid={(e) => {
          // Required and empty: the browser cannot point at a hidden
          // control, so focus the visible field instead.
          if (!enhanced) return;
          e.preventDefault();
          document.getElementById(id ?? "")?.focus();
        }}
      >
        {children}
      </select>
      {enhanced && (
        <ComboboxCore
          id={id}
          options={list.options}
          placeholder={list.placeholder}
          value={value}
          onValueChange={pick}
          disabled={props.disabled}
          required={props.required}
          fieldSize={fieldSize}
          className={className}
          aria-invalid={invalid === true || invalid === "true" ? true : undefined}
          aria-describedby={describedBy}
          aria-label={label}
          aria-labelledby={labelledBy}
          aria-busy={busy === true || busy === "true" || undefined}
        />
      )}
    </>
  );
}
