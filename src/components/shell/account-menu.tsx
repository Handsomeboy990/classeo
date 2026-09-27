"use client";

import { BookOpen, ChevronDown, LogOut, Settings2 } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { PushToggle } from "@/features/push/push-toggle";
import { cn } from "@/lib/utils";

import type { ShellUser } from "./account-sheet";
import { HeaderPopover } from "./header-popover";
import { SignOutButton } from "./sign-out-button";

const ROW =
  "flex min-h-10 w-full items-center gap-3 rounded-control px-2.5 py-2 text-sm font-medium text-text hover:bg-surface-2 [&>svg]:size-[1.125rem] [&>svg]:shrink-0 [&>svg]:text-muted";

// Account entry of the large screen top bar: the person and their role on
// the button, the rest one click away (preferences, guide, push on this
// device, sign out). The phone uses the account sheet instead.
// tone "dark": on the navy top bar.
export function AccountMenu({ user, pushKey, tone = "light" }: { user: ShellUser; pushKey: string | null; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <HeaderPopover
      label="Mon compte"
      width={300}
      trigger={(props) => (
        <button type="button" {...props} aria-label={`Mon compte, ${user.fullName}`} className={cn("group flex min-h-11 items-center gap-2.5 rounded-full py-1 pr-2.5 pl-1", dark ? "hover:bg-white/10" : "hover:bg-surface-2")}>
          <Avatar name={user.fullName} className={cn("size-9", dark && "bg-header-text text-header")} />
          <span className="hidden max-w-44 min-w-0 text-left leading-tight xl:block">
            <span className={cn("block truncate font-display text-sm font-semibold", dark ? "text-header-text" : "text-text")}>{user.fullName}</span>
            <span className={cn("block truncate text-xs", dark ? "text-header-muted" : "text-muted")}>{user.roleName}</span>
          </span>
          <ChevronDown className={cn("size-4 transition-transform group-aria-expanded:rotate-180", dark ? "text-header-muted" : "text-muted")} aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <Avatar name={user.fullName} className="size-11 text-base" />
            <div className="min-w-0">
              <p className="truncate font-display leading-tight font-bold">{user.fullName}</p>
              <p className="truncate text-sm text-muted">{user.roleName}</p>
              <p className="truncate text-xs text-muted">
                <span className="sr-only">Identifiant : </span>
                {user.email}
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-0.5 p-1.5">
            <li>
              <Link href="/espace/preferences" onClick={close} className={ROW}>
                <Settings2 aria-hidden /> Préférences
              </Link>
            </li>
            <li>
              <Link href="/espace/aide" onClick={close} className={ROW}>
                <BookOpen aria-hidden /> Guide d&apos;utilisation
              </Link>
            </li>
          </ul>
          {pushKey && (
            <div className="border-t border-border px-1.5 py-1">
              <PushToggle publicKey={pushKey} />
            </div>
          )}
          <div className="border-t border-border p-1.5">
            <SignOutButton className={`${ROW} text-danger hover:bg-danger-soft [&>svg]:text-danger`}>
              <LogOut aria-hidden /> Se déconnecter
            </SignOutButton>
          </div>
        </div>
      )}
    </HeaderPopover>
  );
}
