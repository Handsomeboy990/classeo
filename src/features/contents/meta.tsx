import { Archive, BookOpen, CalendarDays, CheckCircle2, Megaphone, PencilLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export const CONTENT_TYPES = {
  ANNOUNCEMENT: { label: "Annonce", plural: "Annonces", Icon: Megaphone },
  RESOURCE: { label: "Ressource", plural: "Ressources", Icon: BookOpen },
  EVENT: { label: "Événement", plural: "Événements", Icon: CalendarDays },
} as const;

export type ContentTypeCode = keyof typeof CONTENT_TYPES;

export const MEDIA_LABELS = {
  NONE: "Aucun média",
  AUDIO: "Audio",
  VIDEO: "Vidéo",
  DOCUMENT: "Document",
  IMAGE: "Image",
} as const;

// The type always comes with an icon and a word, never a colour alone.
export function TypeBadge({ type }: { type: ContentTypeCode }) {
  const { label, Icon } = CONTENT_TYPES[type];
  return (
    <Badge tone="info">
      <Icon aria-hidden /> {label}
    </Badge>
  );
}

const STATUSES = {
  DRAFT: { label: "Brouillon", tone: "warning", Icon: PencilLine },
  PUBLISHED: { label: "Publié", tone: "success", Icon: CheckCircle2 },
  ARCHIVED: { label: "Archivé", tone: "neutral", Icon: Archive },
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUSES }) {
  const { label, tone, Icon } = STATUSES[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden /> {label}
    </Badge>
  );
}

// What the read aloud button says: the easy read summary first, then the
// full text.
export function listenText(c: { title: string; easyRead: string | null; body: string }) {
  return [c.title, c.easyRead, c.body].filter(Boolean).join(". ");
}
