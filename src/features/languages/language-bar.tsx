import "server-only";

import { can } from "@/lib/auth/authorize";
import { getCurrentUser } from "@/lib/auth/session";
import { featureConfig, isEnabled } from "@/lib/features";

import { TranslationLayer } from "./translation-layer";

// Mounted once by the private space layout. Renders nothing unless the user
// holds translation:view (parents by default, any profile the ministry adds
// in the rights matrix) and the option is on.
export async function LanguageBar() {
  const user = await getCurrentUser();
  if (!user || !can(user, "translation:view") || !(await isEnabled("languages.translation"))) return null;
  const { languages } = await featureConfig("languages.translation");
  const voices = (await isEnabled("languages.voice")) ? [...(await featureConfig("languages.voice")).languages] : [];
  return <TranslationLayer userId={user.id} languages={[...languages]} voices={voices} />;
}
