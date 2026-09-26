// Messaging rules. Pure, unit tested.

type LastMessage = { senderId: string; createdAt: Date } | null | undefined;

// A conversation is unread when someone else wrote after the user last
// opened it. The user's own messages never make it unread.
export function isUnread(last: LastMessage, lastReadAt: Date | null | undefined, userId: string) {
  if (!last || last.senderId === userId) return false;
  return !lastReadAt || last.createdAt > lastReadAt;
}

// Short preview for lists and notifications, cut on a word boundary.
export function excerpt(text: string, max = 120) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// Voice notes: from a second to two minutes, like the recorder allows.
export const VOICE_NOTE_MIN_MS = 800;
export const VOICE_NOTE_MAX_MS = 120_000;

// "0:07", "1:45": minutes and seconds, as audio players show them.
export function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// The line a voice note shows in lists and notifications.
export function voiceLabel(ms: number | null | undefined) {
  return ms ? `Message vocal (${clock(ms)})` : "Message vocal";
}

// "7 secondes", "1 minute 45": the length read by a screen reader.
export function spokenDuration(ms: number) {
  const total = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const sec = `${s} seconde${s > 1 ? "s" : ""}`;
  if (!m) return sec;
  return `${m} minute${m > 1 ? "s" : ""}${s ? ` ${s}` : ""}`;
}
