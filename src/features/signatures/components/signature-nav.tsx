"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Tabs of the signature section. The server passes only the tabs the user
// may open.
export function SignatureNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  if (items.length < 2) return null;
  // Page tabs of the kit (.ds-tabs): the current one navy over a 3 px rule.
  return (
    <nav aria-label="Rubriques de la signature électronique" className="-mt-2 mb-6 print:hidden">
      <div className="ds-tabs">
        {items.map((item) => {
          const active = item.href === "/espace/signature" ? pathname === item.href : pathname.startsWith(item.href);
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
