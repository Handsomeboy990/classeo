export const REQUEST_TYPES = ["YEAR_EXTENSION", "NEW_SUBJECT", "STAFFING", "INFRASTRUCTURE", "OTHER"] as const;
export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  YEAR_EXTENSION: "Prolongation de période",
  NEW_SUBJECT: "Ouverture de matière ou de classe",
  STAFFING: "Personnel enseignant",
  INFRASTRUCTURE: "Infrastructure et équipement",
  OTHER: "Autre",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Accordée",
  REJECTED: "Refusée",
};

export const REQUEST_STATUS_TONES = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;

export const isRequestType = (v: unknown): v is RequestType => typeof v === "string" && (REQUEST_TYPES as readonly string[]).includes(v);
export const isRequestStatus = (v: unknown): v is RequestStatus => typeof v === "string" && (REQUEST_STATUSES as readonly string[]).includes(v);
