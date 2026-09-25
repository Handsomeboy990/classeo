export const DOC_STATUSES = ["PENDING", "SUBMITTED", "REJECTED", "ACCEPTED"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

// REJECTED means "sent back": the school completes and submits again.
export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  PENDING: "À fournir",
  SUBMITTED: "Transmise, à examiner",
  REJECTED: "Renvoyée, à compléter",
  ACCEPTED: "Acceptée",
};

export const DOC_STATUS_TONES = { PENDING: "warning", SUBMITTED: "info", REJECTED: "danger", ACCEPTED: "success" } as const;

export const isDocStatus = (v: unknown): v is DocStatus => typeof v === "string" && (DOC_STATUSES as readonly string[]).includes(v);

// The school may add files and submit while the request waits for it.
export function schoolCanAnswer(status: DocStatus) {
  return status === "PENDING" || status === "REJECTED";
}

export function isOverdue(r: { status: DocStatus; dueDate: Date | null }, now: Date) {
  return schoolCanAnswer(r.status) && r.dueDate !== null && r.dueDate.getTime() + 86_400_000 <= now.getTime();
}

export const MAX_FILES_PER_REQUEST = 10;
// Server actions accept 1 MB bodies by default (next.config.ts
// serverActions.bodySizeLimit): a file is kept under that until the limit is
// raised, then it can grow to the 5 MB lib/files.ts allows for documents.
export const MAX_DOCUMENT_BYTES = 950_000;
