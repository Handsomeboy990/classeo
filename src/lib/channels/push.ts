import "server-only";

import type { NotificationInput } from "@/lib/notify";

// Web push delivery. Implemented by the push notifications work; until then
// notifications stay in the app only.
export async function deliverPush(userIds: string[], input: NotificationInput): Promise<void> {
  void userIds;
  void input;
}
