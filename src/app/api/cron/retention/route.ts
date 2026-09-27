import { runRetention } from "@/features/connections/retention-run";
import { safeEqual } from "@/lib/demo/access";

// Daily retention purge (features/connections/retention.ts), called by the
// Vercel cron of vercel.json with "Authorization: Bearer <CRON_SECRET>".
// The purge also runs after a sign in, at most once a day, so the cron is a
// safety net for quiet days. Without CRON_SECRET (16 characters at least)
// the route answers 503 and does nothing.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return Response.json({ error: "CRON_SECRET is not set." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const given = request.headers.get("authorization") ?? "";
  if (!safeEqual(given, `Bearer ${secret}`)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const report = await runRetention();
  return Response.json({ ran: report !== null, report }, { headers: { "Cache-Control": "no-store" } });
}
