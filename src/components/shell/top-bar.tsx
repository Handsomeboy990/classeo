"use client";

import type { ShellUser } from "./account-sheet";
import { SpaceLanguageMenu } from "@/features/languages/language-menu";

import { AccountMenu } from "./account-menu";
import { BellLink } from "./bell-link";
import { ScopeIdentity, type ShellScope } from "./scope-identity";

// Top bar of the large screen shell: who the space speaks for on the left
// (flag and territory, or logo and school, with the switcher when the
// account has several schools), the language (for the accounts that may
// translate), notifications and the account on the right. Navigation stays
// in the sidebar; nothing else competes here.
export function TopBar({ scope, unread, user, pushKey, languages }: { scope: ShellScope; unread: number; user: ShellUser; pushKey: string | null; languages: string[] | null }) {
  return (
    <div className="hidden h-16 items-center gap-4 px-6 lg:flex">
      <ScopeIdentity scope={scope} />
      <div className="ml-auto flex items-center gap-1.5">
        {languages && <SpaceLanguageMenu languages={languages} className="mr-1" />}
        <BellLink unread={unread} />
        <span className="mx-1.5 h-6 w-px bg-border" aria-hidden />
        <AccountMenu user={user} pushKey={pushKey} />
      </div>
    </div>
  );
}
