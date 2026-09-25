export const SUBJECT_STATUSES = ["APPROVED", "PENDING", "REJECTED"] as const;
export type SubjectStatus = (typeof SUBJECT_STATUSES)[number];

export const SUBJECT_STATUS_LABELS: Record<SubjectStatus, string> = {
  APPROVED: "Au catalogue",
  PENDING: "Proposée, en attente",
  REJECTED: "Refusée",
};

export const SUBJECT_STATUS_TONES = { APPROVED: "success", PENDING: "warning", REJECTED: "danger" } as const;

export const isSubjectStatus = (v: unknown): v is SubjectStatus => typeof v === "string" && (SUBJECT_STATUSES as readonly string[]).includes(v);

// Codes are short and stable: "SVT", "P-FR", "INFO". Letters, digits and
// dashes, upper case.
export const SUBJECT_CODE = /^[A-Z0-9]{1,8}(-[A-Z0-9]{1,8})?$/;

export function normalizeSubjectCode(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

// A school may not flood the ministry: a few proposals waiting at a time.
export const MAX_PENDING_PROPOSALS = 5;
