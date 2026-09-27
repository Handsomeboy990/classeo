// Page numbers shown by the pagination of DataTable: the first and last
// pages, the current one with its neighbours, and "gap" where pages are
// left out. At most seven entries, so the row fits a phone.
export type PageEntry = number | "gap";

export function pageWindow(page: number, pages: number): PageEntry[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const current = Math.min(Math.max(1, page), pages);
  // Near an end, show five pages on that side so the row keeps its length.
  const start = current <= 4 ? 2 : current >= pages - 3 ? pages - 4 : current - 1;
  const end = current <= 4 ? 5 : current >= pages - 3 ? pages - 1 : current + 1;
  const out: PageEntry[] = [1];
  if (start > 2) out.push("gap");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pages - 1) out.push("gap");
  out.push(pages);
  return out;
}

// "21 à 40 sur 356": the rows shown on this page.
export function rangeLabel(page: number, pageSize: number, count: number, format: (n: number) => string) {
  const from = Math.min(count, (page - 1) * pageSize + 1);
  const to = Math.min(count, page * pageSize);
  return `${format(from)} à ${format(to)} sur ${format(count)}`;
}
