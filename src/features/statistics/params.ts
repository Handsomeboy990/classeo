import { isIndicatorKey, type IndicatorKey } from "@/lib/domain/indicators";
import { param, type SearchParams } from "@/lib/list";

// Sorting of a breakdown: ?tri=<indicator>&ordre=asc|desc.
export function sortParams(sp: SearchParams, fallback: IndicatorKey = "enrollments"): { sort: IndicatorKey; direction: "asc" | "desc" } {
  const tri = param(sp, "tri");
  const sort = isIndicatorKey(tri) ? tri : fallback;
  const direction = param(sp, "ordre") === "asc" ? "asc" : "desc";
  return { sort, direction };
}
