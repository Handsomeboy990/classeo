// Parses the list query string shared by every DataTable: ?q=&page=.
export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export function listParams(sp: SearchParams, pageSize = 20) {
  const q = (param(sp, "q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(param(sp, "page") ?? "1", 10) || 1);
  return { q, page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
