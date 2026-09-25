// Shapes shared by the device queue (IndexedDB), the service worker and the
// replay route. Kept free of any import so the three sides agree on one
// definition. public/sw.js reads the same stored shape (see OFFLINE_DB there).

export const OFFLINE_DB = "classeo-offline";
export const OFFLINE_STORE = "items";
export const OFFLINE_DB_VERSION = 1;
export const SYNC_TAG = "classeo-replay";

export type OfflineKind = "grades" | "attendance" | "message";

export const OFFLINE_KINDS: readonly OfflineKind[] = ["grades", "attendance", "message"];

// "pending": waits for the network. "sending": a replay is in flight.
// "rejected": the server refused it; the typed data stays until the user
// corrects and resends it, or discards it.
export type OfflineStatus = "pending" | "sending" | "rejected";

// Grade cells as the grid sends them.
export type GradeCell = { enrollmentId: string; type: "INTERROGATION" | "DEVOIR" | "COMPOSITION"; sequence: number; value: number | null };
export type GradesPayload = { sheetId: string; cells: GradeCell[] };

export type AttendanceRecordInput = { enrollmentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; reason: string };
export type AttendancePayload = { classroomId: string; date: string; half: "MORNING" | "AFTERNOON"; records: AttendanceRecordInput[] };

export type MessagePayload = { conversationId: string; body: string };

// What the device had read before the user typed: the value of each target
// at that moment. The server compares it with the current value to tell a
// safe overwrite from a conflict.
export type GradesBaseline = { cells: GradeCell[] };
export type AttendanceBaseline = { records: { enrollmentId: string; status: AttendanceRecordInput["status"] | null; reason: string }[] };

export type PayloadOf<K extends OfflineKind> = K extends "grades" ? GradesPayload : K extends "attendance" ? AttendancePayload : MessagePayload;
export type BaselineOf<K extends OfflineKind> = K extends "grades" ? GradesBaseline : K extends "attendance" ? AttendanceBaseline : null;

// One queued entry. Never holds a secret: no cookie, no token, only what the
// user typed, the account it belongs to and where it was typed.
export type QueueItem<K extends OfflineKind = OfflineKind> = {
  clientId: string;
  userId: string;
  kind: K;
  // Groups the entries of one target: a sheet, a register, a conversation.
  target: string;
  payload: PayloadOf<K>;
  baseline: BaselineOf<K>;
  // The page to reopen to correct the entry.
  page: string;
  // Short description for the lists ("Notes, Mathématiques 6e A").
  label: string;
  createdAt: number;
  status: OfflineStatus;
  // Set when the account signed out: kept on the device, never replayed
  // until the same account signs in again.
  sealed: boolean;
  attempts: number;
  error?: string;
  updatedAt: number;
};

// Body of POST /api/offline/replay.
export type ReplayRequest = {
  clientId: string;
  userId: string;
  kind: OfflineKind;
  payload: unknown;
  baseline: unknown;
  createdAt: number;
};

// "applied": written (or already written by an earlier attempt).
// "rejected": refused for good, the reason says why.
// "auth": no valid session, retry after signing in.
// "other-user": the session is another account, the entry stays sealed.
// "retry": temporary failure (busy, rate limit, server error).
export type ReplayOutcome =
  | { outcome: "applied"; message?: string; duplicate?: boolean }
  | { outcome: "rejected"; reason: string }
  | { outcome: "auth" }
  | { outcome: "other-user" }
  | { outcome: "retry"; reason?: string };
