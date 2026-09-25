import { Bell, FileText, Inbox, Megaphone, MessageSquare, UserX, type LucideIcon } from "lucide-react";

// Every kind is shown with an icon and a word: never a colour or a sound alone.
const KINDS: Record<string, { label: string; Icon: LucideIcon }> = {
  absence: { label: "Absence", Icon: UserX },
  report_card: { label: "Bulletin", Icon: FileText },
  message: { label: "Message", Icon: MessageSquare },
  content: { label: "Annonce", Icon: Megaphone },
  request: { label: "Demande", Icon: Inbox },
};

export function notificationKind(kind: string) {
  return KINDS[kind] ?? { label: "Information", Icon: Bell };
}
