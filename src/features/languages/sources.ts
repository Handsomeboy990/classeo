import "server-only";

import { listenText } from "@/features/contents/meta";
import { getVisibleContent } from "@/features/contents/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { isPublicSpeechText } from "@/lib/voice/allowlist";

import { namesFor } from "./names";
import type { TextPolicy } from "./service";

export type TextInput = { text?: string; contentId?: string; part?: "listen" | "transcript" };

// Where a text to translate or to read aloud comes from, decided on the
// server: an announcement the reader may see, read from the database
// (published content, translated as written), a fixed text of the public
// pages, or a free text of the page, sent only as templates (service.ts,
// privacy.ts). Null when the content is not readable by this user.
export async function textSource(input: TextInput): Promise<{ text: string; policy: TextPolicy } | null> {
  if (input.contentId) {
    const user = await getCurrentUser();
    if (!user) return null;
    const content = await getVisibleContent(user, input.contentId);
    if (!content || content.status !== "PUBLISHED") return null;
    const text = input.part === "transcript" ? content.transcript : listenText(content);
    return text ? { text, policy: { kind: "published" } } : null;
  }
  if (!input.text) return null;
  if (isPublicSpeechText(input.text)) return { text: input.text, policy: { kind: "fixed" } };
  const user = await getCurrentUser();
  return { text: input.text, policy: { kind: "free", userId: user?.id ?? null, names: user ? await namesFor(user) : [] } };
}
