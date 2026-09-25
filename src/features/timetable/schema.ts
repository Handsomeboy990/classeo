import { z } from "zod";

const id = z.string().trim().min(1).max(40);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure au format HH:MM.");

export const slotSchema = z.object({
  assignmentId: z.string({ error: "Choisissez une matière." }).trim().min(1, "Choisissez une matière.").max(40),
  dayOfWeek: z.coerce.number().int().min(1, "Choisissez un jour.").max(6, "Choisissez un jour du lundi au samedi."),
  startTime: time,
  endTime: time,
  room: z
    .string()
    .trim()
    .max(60, "Nom de salle trop long.")
    .optional()
    .transform((v) => (v ? v : null)),
});

export const updateSlotSchema = slotSchema.extend({ id });

export const idSchema = z.object({ id });

export const cancelSlotSchema = z.object({
  slotId: id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date."),
  note: z
    .string()
    .trim()
    .max(200, "Motif trop long.")
    .optional()
    .transform((v) => (v ? v : null)),
});
