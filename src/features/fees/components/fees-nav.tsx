"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Section tabs of the fees module. The server passes only the tabs the user
// may open.
export function FeesNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Rubriques des frais scolaires" className="-mt-2 mb-6 overflow-x-auto border-b border-border print:hidden">
      <ul className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = item.href === "/espace/frais" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center border-b-2 px-3 text-sm font-semibold",
                  active ? "border-primary text-primary" : "border-transparent text-muted hover:text-text",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
