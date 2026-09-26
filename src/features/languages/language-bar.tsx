import "server-only";

import { can } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { featureConfig, isEnabled } from "@/lib/features";

import { namesFor } from "./names";
import { TranslationLayer } from "./translation-layer";

export type TranslationAccess = { languages: string[]; voices: string[] };

// Languages this user may switch to: null unless they hold translation:view
// (parents by default, any profile the ministry adds in the rights matrix)
// and the option is on. The layout uses it for the top bar switcher and for
// the layer below.
export async function translationAccess(user: NonNullable<CurrentUser>): Promise<TranslationAccess | null> {
  if (!can(user, "translation:view") || !(await isEnabled("languages.translation"))) return null;
  const { languages } = await featureConfig("languages.translation");
  const voices = (await isEnabled("languages.voice")) ? [...(await featureConfig("languages.voice")).languages] : [];
  return { languages: [...languages], voices };
}

// Mounted once by the private space layout for the users with access.
export async function LanguageBar({ user, access }: { user: NonNullable<CurrentUser>; access: TranslationAccess }) {
  return <TranslationLayer userId={user.id} languages={access.languages} voices={access.voices} names={await namesFor(user)} />;
}
