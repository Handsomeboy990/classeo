import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

// Cache tags. Statistics and reference reads are cached per territorial scope
// and invalidated by the actions that change their inputs. Data that belongs
// to one user is never cached here.
export const tags = {
  territory: "territory",
  schools: "schools",
  school: (id: string) => `school:${id}`,
  stats: "stats",
  contents: "contents",
  roles: "roles",
} as const;

export function cached<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  keyParts: string[],
  options: { tags: string[]; revalidate?: number },
) {
  return unstable_cache(fn, keyParts, { revalidate: options.revalidate ?? 300, tags: options.tags });
}

// Called from server actions after a write: the next read waits for fresh
// data instead of serving the stale entry, so users see their own change.
export function invalidate(...tagList: string[]) {
  for (const tag of tagList) revalidateTag(tag, { expire: 0 });
}
