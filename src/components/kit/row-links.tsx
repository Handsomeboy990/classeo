"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const INTERACTIVE = "a, button, input, select, textarea, label, summary, details, dialog, [role='button'], [role='dialog'], [contenteditable='true']";

// Makes every row of the table around it that carries data-href open that
// address when clicked anywhere, as in a native list. The row keeps a real
// link in its main cell: keyboard and screen reader users follow that one,
// and a click on any other link or button in the row does what it says.
// Ctrl, Cmd or the middle button open a new tab; selecting text does not
// navigate.
export function RowLinks() {
  const ref = useRef<HTMLSpanElement>(null);
  const router = useRouter();

  useEffect(() => {
    const root = ref.current?.parentElement;
    if (!root) return;
    function rowOf(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest(INTERACTIVE)) return null;
      const row = target.closest<HTMLTableRowElement>("tr[data-href]");
      return row && root!.contains(row) ? row : null;
    }
    function onClick(e: MouseEvent) {
      const row = rowOf(e);
      if (!row || e.button !== 0 || window.getSelection()?.toString()) return;
      const href = row.dataset.href!;
      if (e.metaKey || e.ctrlKey || e.shiftKey) window.open(href, "_blank", "noopener");
      else router.push(href);
    }
    function onAux(e: MouseEvent) {
      const row = rowOf(e);
      if (row && e.button === 1) window.open(row.dataset.href!, "_blank", "noopener");
    }
    // Prefetch on hover, like the link itself would.
    function onOver(e: MouseEvent) {
      const row = rowOf(e);
      if (row && !row.dataset.prefetched) {
        row.dataset.prefetched = "";
        router.prefetch(row.dataset.href!);
      }
    }
    root.addEventListener("click", onClick);
    root.addEventListener("auxclick", onAux);
    root.addEventListener("mouseover", onOver);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("auxclick", onAux);
      root.removeEventListener("mouseover", onOver);
    };
  }, [router]);

  return <span ref={ref} hidden />;
}
