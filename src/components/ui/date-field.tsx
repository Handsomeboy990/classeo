"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type KeyboardEvent, type Ref } from "react";

import { cn } from "@/lib/utils";

import { addDays, addMonths, inRange, monthGrid, MONTHS, parseIso, parseTyped, spokenDate, toDisplay, todayIso, WEEKDAYS, weekday } from "./date-utils";
import { supportsPopover, useAnchoredPanel } from "./popover-position";

type Props = ComponentProps<"input"> & { fieldSize?: "sm" | "md" | "lg" };

const setNativeValue = Object.getOwnPropertyDescriptor(typeof HTMLInputElement === "undefined" ? Object : HTMLInputElement.prototype, "value")?.set;

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T }).current = value;
}

// Date field of the design system: the date typed as jj/mm/aaaa or picked in
// a calendar (French, Monday first, keyboard driven as in the WAI-ARIA date
// picker dialog). The native <input type="date"> is kept, hidden, as the
// value: it submits the ISO date under the field's name, applies min, max
// and required, and fires React's onChange. Before hydration or on a
// browser without the Popover API, the native field is shown instead.
export function DateField({ className, fieldSize = "md", id, ref, ...props }: Props) {
  const nativeRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [enhanced, setEnhanced] = useState(false);
  const [value, setValue] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useAnchoredPanel(open, wrapRef, panelRef, { matchWidth: false, minWidth: 304, preferredHeight: 420 });

  const min = typeof props.min === "string" ? props.min : undefined;
  const max = typeof props.max === "string" ? props.max : undefined;

  useLayoutEffect(() => {
    if (!supportsPopover() || !nativeRef.current) return;
    setValue(nativeRef.current.value);
    setEnhanced(true);
  }, []);

  const sync = useCallback(() => {
    const el = nativeRef.current;
    if (el) setValue(el.value);
  }, []);
  // A controlled value or a form reset can change the native field without
  // an event reaching us.
  useEffect(() => {
    if (enhanced) sync();
  });
  useEffect(() => {
    const el = nativeRef.current;
    if (!enhanced || !el) return;
    const onReset = () => setTimeout(() => {
      sync();
      setText(null);
      setError(null);
    });
    el.form?.addEventListener("reset", onReset);
    return () => el.form?.removeEventListener("reset", onReset);
  }, [enhanced, sync]);

  function commit(iso: string) {
    const el = nativeRef.current;
    if (!el) return;
    setNativeValue?.call(el, iso);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    setValue(iso);
    setText(null);
    setError(null);
  }

  function commitTyped() {
    if (text === null) return;
    if (!text.trim()) {
      commit("");
      return;
    }
    const iso = parseTyped(text);
    if (!iso) {
      setError("Date non reconnue. Écrivez-la sous la forme jj/mm/aaaa, par exemple 05/10/2026.");
      return;
    }
    if (!inRange(iso, min, max)) {
      setError(rangeMessage(min, max));
      return;
    }
    commit(iso);
  }

  function closeCalendar(focusButton: boolean) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }

  const {
    "aria-invalid": invalid,
    "aria-describedby": describedBy,
    required,
    disabled,
    placeholder,
    ...rest
  } = props;
  const errorId = `${fieldId}-date-error`;
  const isInvalid = !!error || invalid === true || invalid === "true";

  return (
    <>
      <input
        {...rest}
        ref={(el) => {
          nativeRef.current = el;
          assignRef(ref, el);
        }}
        type="date"
        id={enhanced ? undefined : id}
        required={required}
        disabled={disabled}
        className={cn("ds-field", enhanced && "sr-only", className)}
        data-size={fieldSize === "md" ? undefined : fieldSize}
        aria-invalid={enhanced ? undefined : invalid}
        aria-describedby={enhanced ? undefined : describedBy}
        aria-hidden={enhanced || undefined}
        tabIndex={enhanced ? -1 : props.tabIndex}
        onInvalid={(e) => {
          if (!enhanced) return;
          e.preventDefault();
          textRef.current?.focus();
        }}
      />
      {enhanced && (
        <div ref={wrapRef} className={cn("ds-adorned", className)} data-end="">
          <input
            ref={textRef}
            id={fieldId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder ?? "jj/mm/aaaa"}
            className="ds-field tabular-nums"
            data-size={fieldSize === "md" ? undefined : fieldSize}
            value={text ?? toDisplay(value)}
            required={required}
            disabled={disabled}
            aria-invalid={isInvalid || undefined}
            aria-describedby={[describedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onBlur={commitTyped}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text !== null) {
                e.preventDefault();
                commitTyped();
              }
              if (e.key === "ArrowDown" && e.altKey) {
                e.preventDefault();
                setOpen(true);
              }
            }}
          />
          <span className="ds-adornment" data-side="end" data-interactive="">
            <button
              ref={buttonRef}
              type="button"
              disabled={disabled}
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={value ? `Changer la date, ${spokenDate(value)}` : "Choisir une date dans le calendrier"}
              className="-mr-2 inline-flex size-9 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-text"
            >
              <CalendarDays className="size-[1.125rem]" aria-hidden />
            </button>
          </span>
          <div
            ref={panelRef}
            popover="manual"
            role="dialog"
            aria-modal="false"
            aria-label="Calendrier"
            className="ds-popover ds-calendar-panel"
            // Safari does not focus a button on click: keep focus where it
            // is so the calendar does not close under the pointer. The month
            // and year lists still open.
            onMouseDown={(e) => {
              if (!(e.target as HTMLElement).closest("select")) e.preventDefault();
            }}
            onBlur={(e) => {
              const to = e.relatedTarget as Node | null;
              if (to && (panelRef.current?.contains(to) || buttonRef.current === to)) return;
              setOpen(false);
            }}
          >
            {open && (
              <Calendar
                value={value}
                min={min}
                max={max}
                allowClear={!required}
                onPick={(iso) => {
                  commit(iso);
                  closeCalendar(true);
                }}
                onClose={() => closeCalendar(true)}
              />
            )}
          </div>
        </div>
      )}
      {enhanced && error && (
        <p id={errorId} className="text-[0.8125rem] leading-snug font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function rangeMessage(min?: string, max?: string) {
  if (min && max) return `Choisissez une date entre le ${toDisplay(min)} et le ${toDisplay(max)}.`;
  if (min) return `Choisissez une date à partir du ${toDisplay(min)}.`;
  return `Choisissez une date jusqu'au ${toDisplay(max!)}.`;
}

function Calendar({
  value,
  min,
  max,
  allowClear,
  onPick,
  onClose,
}: {
  value: string;
  min?: string;
  max?: string;
  allowClear: boolean;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const today = todayIso();
  const start = parseIso(value) ? value : inRange(today, min, max) ? today : (min ?? max ?? today);
  const [focus, setFocus] = useState(start);
  const gridRef = useRef<HTMLTableElement>(null);
  const moved = useRef(false);
  const f = parseIso(focus)!;
  const weeks = monthGrid(f.y, f.m);
  const minY = min ? parseIso(min)!.y : Math.min(f.y, parseIso(today)!.y) - 100;
  const maxY = max ? parseIso(max)!.y : Math.max(f.y, parseIso(today)!.y) + 10;
  const years = Array.from({ length: maxY - minY + 1 }, (_, i) => maxY - i);
  const titleId = useId();

  // Focus lands on the selected day (or today) when the calendar opens, and
  // follows the keyboard afterwards.
  useEffect(() => {
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`button[data-iso="${focus}"]`);
    if (!moved.current) {
      moved.current = true;
      requestAnimationFrame(() => btn?.focus());
      return;
    }
    if (gridRef.current?.contains(document.activeElement)) btn?.focus();
  }, [focus]);

  function onGridKey(e: KeyboardEvent) {
    const map: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -weekday(focus)),
      End: () => addDays(focus, 6 - weekday(focus)),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
    };
    const next = map[e.key];
    if (next) {
      e.preventDefault();
      setFocus(next());
    }
  }

  const monthLabel = `${MONTHS[f.m]} ${f.y}`;
  const nav = "inline-flex size-9 items-center justify-center rounded-control text-text hover:bg-surface-2 disabled:opacity-40";
  const prevDisabled = !!min && addMonths(focus, -1).slice(0, 7) < min.slice(0, 7);
  const nextDisabled = !!max && addMonths(focus, 1).slice(0, 7) > max.slice(0, 7);

  return (
    <div
      className="p-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center gap-1">
        <button type="button" className={nav} onClick={() => setFocus(addMonths(focus, -1))} disabled={prevDisabled} aria-label="Mois précédent">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 justify-center gap-1">
          <label className="sr-only" htmlFor={`${titleId}-m`}>
            Mois
          </label>
          <select
            id={`${titleId}-m`}
            className="ds-cal-select"
            value={f.m}
            onChange={(e) => setFocus(clampDay(f.y, Number(e.target.value), f.d))}
          >
            {MONTHS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${titleId}-y`}>
            Année
          </label>
          <select id={`${titleId}-y`} className="ds-cal-select tabular-nums" value={f.y} onChange={(e) => setFocus(clampDay(Number(e.target.value), f.m, f.d))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={nav} onClick={() => setFocus(addMonths(focus, 1))} disabled={nextDisabled} aria-label="Mois suivant">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <p id={titleId} className="sr-only" aria-live="polite">
        {monthLabel}
      </p>
      <table ref={gridRef} role="grid" aria-labelledby={titleId} className="mt-2 w-full border-collapse text-center" onKeyDown={onGridKey}>
        <thead>
          <tr>
            {WEEKDAYS.map(([short, full]) => (
              <th key={full} scope="col" abbr={full} className="pb-1 text-xs font-semibold text-muted">
                {short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((iso) => {
                const p = parseIso(iso)!;
                const outside = p.m !== f.m;
                const selected = iso === value;
                const allowed = inRange(iso, min, max);
                return (
                  <td key={iso} className="p-0.5" aria-selected={selected || undefined}>
                    <button
                      type="button"
                      data-iso={iso}
                      tabIndex={iso === focus ? 0 : -1}
                      aria-label={spokenDate(iso)}
                      aria-current={iso === today ? "date" : undefined}
                      aria-disabled={!allowed || undefined}
                      onClick={() => (allowed ? onPick(iso) : setFocus(iso))}
                      className="ds-day"
                      data-outside={outside || undefined}
                      data-selected={selected || undefined}
                      data-today={iso === today || undefined}
                    >
                      {p.d}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
        <button
          type="button"
          className="inline-flex min-h-9 items-center rounded-control px-2.5 text-sm font-semibold text-primary hover:bg-primary-soft disabled:opacity-40"
          disabled={!inRange(today, min, max)}
          onClick={() => onPick(today)}
        >
          Aujourd&apos;hui
        </button>
        {allowClear && value && (
          <button type="button" className="inline-flex min-h-9 items-center rounded-control px-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text" onClick={() => onPick("")}>
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}

function clampDay(y: number, m: number, d: number) {
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
