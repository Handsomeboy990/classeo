"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Tabs of the signature section. The server passes only the tabs the user
// may open.
export function SignatureNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  if (items.length < 2) return null;
  return (
    <nav aria-label="Rubriques de la signature électronique" className="-mt-2 mb-6 overflow-x-auto border-b border-border print:hidden">
      <ul className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = item.href === "/espace/signature" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("inline-flex h-11 items-center border-b-2 px-3 text-sm font-semibold", active ? "border-primary text-primary" : "border-transparent text-muted hover:text-text")}
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
