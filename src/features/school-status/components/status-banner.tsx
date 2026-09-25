import { Alert } from "@/components/ui/alert";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

// Banner shown to the staff of a suspended or closed school, on every page
// of their space: they understand at once why nothing can be saved. Renders
// nothing for anyone else. Meant for the app shell (src/app/espace/layout.tsx).
export async function SchoolStatusBanner({ user }: { user: NonNullable<CurrentUser> }) {
  if (user.scope.level !== "SCHOOL" || !user.scope.schoolId) return null;
  const school = await db.school.findUnique({ where: { id: user.scope.schoolId }, select: { name: true, status: true, statusReason: true, statusChangedAt: true } });
  if (!school || school.status === "ACTIVE") return null;
  const suspended = school.status === "SUSPENDED";
  return (
    <Alert tone={suspended ? "warning" : "danger"} title={`${school.name} est ${suspended ? "suspendu" : "fermé"}${school.statusChangedAt ? ` depuis le ${formatDate(school.statusChangedAt)}` : ""}`} className="mb-5">
      <p>
        Vous pouvez tout consulter, mais aucune modification n&apos;est enregistrée{suspended ? " jusqu'à la réactivation par la tutelle" : ""}.
        {school.statusReason ? ` Motif : ${school.statusReason}` : ""}
      </p>
    </Alert>
  );
}
