"use client";

import type { ShellUser } from "./account-sheet";
import { SpaceLanguageMenu } from "@/features/languages/language-menu";

import { AccountMenu } from "./account-menu";
import { BellLink } from "./bell-link";
import { ScopeIdentity, type ShellScope } from "./scope-identity";

// Top bar of the large screen shell, the navy band of the State sites
// (design source of truth, part 3.4, navy by the owner's choice): who the
// space speaks for on the left (flag and territory, or logo and school,
// with the switcher when the account has several schools), the language
// (for the accounts that may translate), notifications and the account on
// the right. It continues the brand zone of the sidebar, same height and
// colour. Navigation stays in the sidebar; nothing else competes here.
export function TopBar({ scope, unread, user, pushKey, languages }: { scope: ShellScope; unread: number; user: ShellUser; pushKey: string | null; languages: string[] | null }) {
  return (
    <div data-top-bar className="hidden h-16 items-center gap-4 border-b border-white/10 bg-header px-6 text-header-text lg:flex">
      <ScopeIdentity scope={scope} tone="dark" />
      <div className="ml-auto flex items-center gap-1.5">
        {languages && <SpaceLanguageMenu languages={languages} tone="header" className="mr-1" />}
        <BellLink unread={unread} tone="dark" className="lg:size-10" />
        <span className="mx-1.5 h-6 w-px bg-white/20" aria-hidden />
        <AccountMenu user={user} pushKey={pushKey} tone="dark" />
      </div>
    </div>
  );
}
