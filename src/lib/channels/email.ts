import "server-only";

import type { NotificationInput } from "@/lib/notify";

// E-mail delivery of notifications. Implemented by the e-mail work; until
// then notifications stay in the app only.
export async function deliverEmail(userIds: string[], input: NotificationInput): Promise<void> {
  void userIds;
  void input;
}
