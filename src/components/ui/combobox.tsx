"use client";

import { Check, ChevronDown } from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import { fold, useAnchoredPanel } from "./popover-position";

export type ComboOption = { value: string; label: string; group?: string; disabled?: boolean };

type Size = "sm" | "md" | "lg";

export type ComboboxCoreProps = {
  id?: string;
  options: ComboOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  fieldSize?: Size;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-busy"?: boolean;
};

// Searchable list box (WAI-ARIA combobox with a list popup). The field keeps
// DOM focus, the highlighted option is announced through
// aria-activedescendant. Typing filters, accents and case ignored; arrows,
// Home, End, Enter and Escape work as in the native control. The list opens
// in the top layer, under the field or above it when there is more room.
export function ComboboxCore({
  id,
  options,
  value,
  onValueChange,
  placeholder = "Choisir…",
  disabled,
  required,
  fieldSize = "md",
  className,
  ...aria
}: ComboboxCoreProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useAnchoredPanel(open, wrapRef, panelRef, { preferredHeight: 320 });

  const selected = options.find((o) => o.value === value) ?? null;
  const q = query === null ? "" : fold(query);
  const shown = useMemo(() => (q ? options.filter((o) => fold(`${o.label} ${o.group ?? ""}`).includes(q)) : options), [options, q]);
  const enabled = shown.filter((o) => !o.disabled);
  const optionId = (v: string) => `${inputId}-opt-${options.findIndex((o) => o.value === v)}`;

  function show(target?: string | null) {
    if (disabled) return;
    setOpen(true);
    setActive(target ?? (selected && !selected.disabled ? selected.value : (enabled[0]?.value ?? null)));
  }
  function close() {
    setOpen(false);
    setQuery(null);
    setActive(null);
  }
  function choose(o: ComboOption) {
    if (o.disabled) return;
    if (o.value !== value) onValueChange(o.value);
    close();
  }
  function move(delta: number | "first" | "last") {
    if (!enabled.length) return;
    let i = enabled.findIndex((o) => o.value === active);
    if (delta === "first") i = 0;
    else if (delta === "last") i = enabled.length - 1;
    else i = i < 0 ? (delta > 0 ? 0 : enabled.length - 1) : Math.min(enabled.length - 1, Math.max(0, i + delta));
    const next = enabled[i]!.value;
    setActive(next);
    requestAnimationFrame(() => document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" }));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) show();
        else move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) show();
        else move(-1);
        break;
      case "PageDown":
        if (open) {
          e.preventDefault();
          move(8);
        }
        break;
      case "PageUp":
        if (open) {
          e.preventDefault();
          move(-8);
        }
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          move("first");
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          move("last");
        }
        break;
      case "Enter": {
        if (!open) return;
        // Never submits the form while the list is open.
        e.preventDefault();
        const o = enabled.find((x) => x.value === active);
        if (o) choose(o);
        else close();
        break;
      }
      case "Escape":
        if (open || query !== null) {
          // Closes the list only, not the dialog around the field.
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case "Tab":
        if (open && query !== null && q) {
          const o = enabled.find((x) => x.value === active);
          if (o) choose(o);
          else close();
        } else if (open) close();
        break;
    }
  }

  const groups: { name: string | undefined; items: ComboOption[] }[] = [];
  for (const o of shown) {
    const last = groups[groups.length - 1];
    if (last && last.name === o.group) last.items.push(o);
    else groups.push({ name: o.group, items: [o] });
  }

  return (
    <div ref={wrapRef} className={cn("ds-combo relative w-full min-w-0", className)} data-open={open || undefined}>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={open && active !== null ? optionId(active) : undefined}
        aria-required={required || undefined}
        {...aria}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        className="ds-field pr-10 text-ellipsis"
        data-size={fieldSize === "md" ? undefined : fieldSize}
        placeholder={selected && query !== null ? selected.label : placeholder}
        value={query ?? selected?.label ?? ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          const f = fold(e.target.value);
          const first = options.find((o) => !o.disabled && (!f || fold(`${o.label} ${o.group ?? ""}`).includes(f)));
          setActive(first?.value ?? null);
        }}
        onClick={() => (open ? close() : show())}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => {
          if (panelRef.current?.contains(e.relatedTarget as Node | null)) return;
          close();
        }}
        onKeyDown={onKeyDown}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted" aria-hidden>
        <ChevronDown className={cn("size-[1.125rem] transition-transform duration-150", open && "rotate-180")} />
      </span>
      <div ref={panelRef} popover="manual" className="ds-popover ds-combo-panel" onMouseDown={(e) => e.preventDefault()}>
        <div role="listbox" id={listId} aria-label={aria["aria-label"] ?? "Options"} className="max-h-(--panel-max-h) overflow-y-auto overscroll-contain p-1">
          {groups.map((g, gi) => {
            const items = g.items.map((o) => {
              const isActive = o.value === active;
              const isSelected = o.value === value;
              return (
                <div
                  key={`${o.group ?? ""}:${o.value}`}
                  id={optionId(o.value)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  data-active={isActive || undefined}
                  onPointerMove={() => !o.disabled && active !== o.value && setActive(o.value)}
                  onClick={() => choose(o)}
                  className="ds-option"
                >
                  <span className="min-w-0 flex-1">{o.label}</span>
                  {isSelected && <Check className="size-4 shrink-0" aria-hidden />}
                </div>
              );
            });
            if (!g.name) return <div key={`g${gi}`} role="presentation">{items}</div>;
            const hid = `${inputId}-g${gi}`;
            return (
              <div key={`g${gi}`} role="group" aria-labelledby={hid}>
                <div id={hid} role="presentation" className="ds-option-group">
                  {g.name}
                </div>
                {items}
              </div>
            );
          })}
        </div>
        {shown.length === 0 && (
          <p className="px-3 py-3 text-sm text-muted" role="status">
            Aucun résultat pour « {query?.trim()} ».
          </p>
        )}
      </div>
    </div>
  );
}
