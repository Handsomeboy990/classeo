import { z } from "zod";

import { requiresTranscript } from "@/lib/domain/content-targeting";

export const TRANSCRIPT_REQUIRED =
  "La transcription est obligatoire pour un audio ou une vidéo : les personnes sourdes ou malentendantes doivent pouvoir lire tout ce qui est dit.";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => (v ? v : null));

// Relative paths on the platform or http(s) links only: never javascript: or
// data: URLs, which would run in the reader's browser. A relative path may not
// hold a backslash: browsers read "/\host" as "//host", another site, which
// the page would then embed as if it were platform media.
const mediaUrl = optionalText(500, "L'adresse est trop longue (500 caractères au plus).").refine(
  (v) => v === null || /^https?:\/\/[^\s]+$/i.test(v) || /^\/[^\s/\\][^\s\\]*$/.test(v),
  "Saisissez une adresse qui commence par https:// ou par /.",
);

export const contentSchema = z
  .object({
    id: z.string().min(1).max(40).optional(),
    type: z.enum(["ANNOUNCEMENT", "RESOURCE", "EVENT"], "Choisissez un type de contenu."),
    title: z.string().trim().min(3, "Le titre doit compter au moins 3 caractères.").max(160, "Le titre est trop long (160 caractères au plus)."),
    easyRead: optionalText(280, "Le résumé facile à lire doit rester court (280 caractères au plus)."),
    body: z.string().trim().min(10, "Le texte doit compter au moins 10 caractères.").max(10000, "Le texte est trop long (10 000 caractères au plus)."),
    audience: z.enum(["EVERYONE", "PARENTS", "STUDENTS", "TEACHERS", "STAFF"], "Choisissez un public."),
    target: z.string().min(1, "Choisissez à qui s'adresse ce contenu."),
    mediaType: z.enum(["NONE", "AUDIO", "VIDEO", "DOCUMENT", "IMAGE"], "Choisissez un type de média."),
    mediaUrl,
    transcript: optionalText(20000, "La transcription est trop longue (20 000 caractères au plus)."),
    subjectLabel: optionalText(80, "La matière est trop longue (80 caractères au plus)."),
    eventDate: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    intent: z.enum(["draft", "publish"]).default("draft"),
  })
  .superRefine((v, ctx) => {
    if (requiresTranscript(v.mediaType) && !v.transcript)
      ctx.addIssue({ code: "custom", path: ["transcript"], message: TRANSCRIPT_REQUIRED });
    if ((v.mediaType === "DOCUMENT" || v.mediaType === "IMAGE") && !v.mediaUrl)
      ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "Indiquez l'adresse du document ou de l'image." });
    if (v.type === "EVENT") {
      if (!v.eventDate) ctx.addIssue({ code: "custom", path: ["eventDate"], message: "Indiquez la date et l'heure de l'événement." });
      else if (Number.isNaN(parseEventDate(v.eventDate).getTime()))
        ctx.addIssue({ code: "custom", path: ["eventDate"], message: "La date de l'événement est invalide." });
    }
  });

export type ContentInput = z.infer<typeof contentSchema>;

// datetime-local values carry no zone: they are read as Benin time (UTC+1,
// no daylight saving).
export function parseEventDate(value: string) {
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return new Date(`${value}:00+01:00`);
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(value)) return new Date(`${value}+01:00`);
  return new Date(Number.NaN);
}

export function toEventInput(d: Date | null) {
  if (!d) return "";
  const local = new Date(d.getTime() + 60 * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
