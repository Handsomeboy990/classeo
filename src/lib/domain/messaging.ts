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
