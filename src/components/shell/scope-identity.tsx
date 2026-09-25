"use client";

import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BeninFlag } from "@/components/brand/flag";
import { toast } from "@/components/kit/toaster";
import { cn, initials } from "@/lib/utils";

import { HeaderPopover } from "./header-popover";
import { switchSchool } from "./switch-school";

// Who the top bar speaks for. Territorial staff (nation, department,
// commune) and families see the flag of Benin with the name of their
// territory; school staff see the logo and the name of their school.
export type ShellScope = {
  kind: "territory" | "school" | "family";
  name: string;
  // Level in words, shown small next to the name on large screens.
  caption: string;
  logoUrl: string | null;
  schools: { id: string; name: string }[];
  activeSchoolId: string | null;
};

function SchoolLogo({ scope, className }: { scope: ShellScope; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (scope.logoUrl && !broken)
    return (
      // A plain img: the logo is served by our authorized file route and
      // needs no resizing. Decorative, the school name follows.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={scope.logoUrl} alt="" onError={() => setBroken(true)} className={cn("size-9 shrink-0 rounded-lg border border-border bg-white object-contain p-0.5", className)} />
    );
  return (
    <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-on-primary", className)}>
      {initials(scope.name)}
    </span>
  );
}

// The flag, or the school logo.
export function ScopeMark({ scope, className }: { scope: ShellScope; className?: string }) {
  return scope.kind === "school" ? <SchoolLogo scope={scope} className={className} /> : <BeninFlag className={cn("h-6", className)} />;
}

// Accounts attached to several schools (a teacher appointed in two) pick the
// one they work in. The whole space then follows that school.
export function SchoolSwitcher({ scope, compact = false }: { scope: ShellScope; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <HeaderPopover
      label="Changer d'établissement"
      align="start"
      width={300}
      className="min-w-0"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={cn(
            "group flex min-w-0 items-center gap-2.5 rounded-lg text-left hover:bg-surface-2",
            compact ? "-ml-1 min-h-11 px-1" : "-ml-2 min-h-12 px-2",
          )}
        >
          <IdentityText scope={scope} compact={compact} />
          {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-hidden /> : <ChevronsUpDown className="size-4 shrink-0 text-muted group-hover:text-text" aria-hidden />}
          <span className="sr-only">, changer d&apos;établissement</span>
        </button>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <p className="px-2.5 pt-1.5 pb-2 text-xs font-semibold text-muted">Vos établissements</p>
          <ul className="flex flex-col gap-0.5">
            {scope.schools.map((s) => {
              const current = s.id === scope.activeSchoolId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={current ? "true" : undefined}
                    disabled={pending}
                    onClick={() => {
                      close();
                      if (current) return;
                      start(async () => {
                        const fd = new FormData();
                        fd.set("schoolId", s.id);
                        const result = await switchSchool(null, fd);
                        if (result?.message) toast(result.ok ? "success" : "error", result.message);
                        if (result?.ok) router.refresh();
                      });
                    }}
                    className={cn("flex min-h-11 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm font-medium hover:bg-surface-2", current && "text-primary")}
                  >
                    <span className="min-w-0 flex-1">{s.name}</span>
                    {current && <Check className="size-4 shrink-0" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </HeaderPopover>
  );
}

function IdentityText({ scope, compact }: { scope: ShellScope; compact: boolean }) {
  return (
    <>
      <ScopeMark scope={scope} className={compact && scope.kind === "school" ? "size-8" : undefined} />
      <span className="min-w-0">
        <span className={cn("block truncate leading-tight font-bold text-text", compact ? "text-[0.9375rem]" : "font-display text-[1.0625rem]")}>{scope.name}</span>
        <span className={cn("block truncate text-xs leading-tight text-muted", compact && "sr-only")}>{scope.caption}</span>
      </span>
    </>
  );
}

// The identity block at the start of the top bar.
export function ScopeIdentity({ scope, compact = false }: { scope: ShellScope; compact?: boolean }) {
  if (scope.kind === "school" && scope.schools.length > 1) return <SchoolSwitcher scope={scope} compact={compact} />;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <IdentityText scope={scope} compact={compact} />
    </div>
  );
}
