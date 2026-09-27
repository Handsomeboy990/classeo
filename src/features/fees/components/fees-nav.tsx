"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Section tabs of the fees module. The server passes only the tabs the user
// may open.
export function FeesNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // Page tabs of the kit (.ds-tabs): the current one navy over a 3 px rule.
  return (
    <nav aria-label="Rubriques des frais scolaires" className="-mt-2 mb-6 print:hidden">
      <div className="ds-tabs">
        {items.map((item) => {
          const active = item.href === "/espace/frais" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
