// French labels for the people enums. Safe for client and server.

export const DISABILITY_LABELS = {
  VISUAL: "Déficience visuelle",
  HEARING: "Déficience auditive",
  MOTOR: "Handicap moteur",
  COGNITIVE: "Trouble cognitif",
} as const;

export const DISABILITIES = Object.keys(DISABILITY_LABELS) as (keyof typeof DISABILITY_LABELS)[];

export const GENDER_LABELS = { F: "Fille", M: "Garçon" } as const;

export const ENROLLMENT_STATUS_LABELS = {
  ACTIVE: "Inscrit",
  TRANSFERRED: "Transféré",
  WITHDRAWN: "Retiré",
} as const;

export const CHANNEL_LABELS = {
  APP: "Application",
  SMS: "SMS",
  VOICE_CALL: "Appel vocal",
} as const;

export const RELATIONSHIPS = ["Mère", "Père", "Tuteur", "Tutrice", "Grand-parent", "Oncle", "Tante", "Frère ou sœur aîné"] as const;

const short = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
// Calendar dates (birth dates, attendance days) are stored at midnight UTC.
export function shortDate(d: Date | string) {
  return short.format(typeof d === "string" ? new Date(d) : d);
}
