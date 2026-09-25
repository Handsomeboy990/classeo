"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { can, ForbiddenError } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { AUDIENCE_MISFIT, audienceFitsTarget, MAX_RECIPIENTS, targetLevel, type AudienceCode, type TargetIds } from "@/lib/domain/content-targeting";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";

import { activeYearId, manageableWhere, resolveRecipientsForWrite, resolveTargetForWrite } from "./queries";
import { contentSchema, parseEventDate, type ContentInput } from "./schema";

type User = NonNullable<CurrentUser>;

const NOT_FOUND = "Ce contenu est introuvable ou hors de votre périmètre.";

function contentData(input: ContentInput) {
  const hasMedia = input.mediaType !== "NONE";
  return {
    type: input.type,
    title: input.title,
    easyRead: input.easyRead,
    body: input.body,
    audience: input.audience,
    mediaType: input.mediaType,
    mediaUrl: hasMedia ? input.mediaUrl : null,
    transcript: hasMedia ? input.transcript : null,
    subjectLabel: input.type === "RESOURCE" ? input.subjectLabel : null,
    eventDate: input.type === "EVENT" && input.eventDate ? parseEventDate(input.eventDate) : null,
  };
}

function assertCanPublish(user: User, input: ContentInput) {
  if (input.intent === "publish" && !can(user, "content:publish")) throw new ForbiddenError("Votre rôle ne permet pas de publier. Enregistrez un brouillon.");
}

async function findManageable(user: User, id: string) {
  const found = await db.content.findFirst({ where: { AND: [{ id }, await manageableWhere(user)] } });
  if (!found) throw new DomainError(NOT_FOUND);
  return found;
}

// Readers of a school or class content hear about it right away, following
// the same rule as the list: inside the target and in the audience. Wider
// targets (commune, department, nation) reach too many accounts for a
// synchronous write and rely on the list and the ticker instead. Accounts
// whose role cannot open contents are left out: the link would refuse them.
type Notifiable = { id: string; title: string; audience: string; schoolId: string | null; classroomId: string | null };

async function readerIds(c: Notifiable) {
  if (!c.schoolId) return [];
  const yearId = await activeYearId();
  const enrolled: Prisma.EnrollmentWhereInput = c.classroomId
    ? { classroomId: c.classroomId, academicYearId: yearId, status: "ACTIVE" }
    : { schoolId: c.schoolId, academicYearId: yearId, status: "ACTIVE" };
  const wants = (a: string) => c.audience === "EVERYONE" || c.audience === a;
  const lists: Promise<(string | null)[]>[] = [];
  if (wants("PARENTS"))
    lists.push(db.guardian.findMany({ where: { userId: { not: null }, students: { some: { student: { enrollments: { some: enrolled } } } } }, select: { userId: true }, take: 2000 }).then((r) => r.map((x) => x.userId)));
  if (wants("STUDENTS")) lists.push(db.student.findMany({ where: { userId: { not: null }, enrollments: { some: enrolled } }, select: { userId: true }, take: 2000 }).then((r) => r.map((x) => x.userId)));
  if (wants("TEACHERS"))
    lists.push(
      db.teacher
        .findMany({
          where: c.classroomId
            ? { userId: { not: null }, isActive: true, OR: [{ assignments: { some: { classroomId: c.classroomId } } }, { mainClasses: { some: { id: c.classroomId } } }] }
            : { userId: { not: null }, isActive: true, schoolId: c.schoolId },
          select: { userId: true },
          take: 500,
        })
        .then((r) => r.map((x) => x.userId)),
    );
  // A class has no staff of its own: staff hear only about school contents.
  if (wants("STAFF") && !c.classroomId)
    lists.push(db.user.findMany({ where: { schoolId: c.schoolId, scopeLevel: "SCHOOL", role: { code: { not: "TEACHER" } } }, select: { id: true }, take: 200 }).then((r) => r.map((x) => x.id)));
  const ids = [...new Set((await Promise.all(lists)).flat().filter((x): x is string => !!x))];
  if (!ids.length) return [];
  const allowed = await db.user.findMany({
    where: { id: { in: ids }, isActive: true, role: { permissions: { some: { permission: { code: "content:view" } } } } },
    select: { id: true },
  });
  return allowed.map((u) => u.id);
}

async function notifyReaders(user: User, c: Notifiable) {
  const ids = await readerIds(c);
  await notify(
    ids.filter((id) => id !== user.id),
    { kind: "content", title: "Nouvelle publication", body: c.title, link: `/espace/contenus/${c.id}` },
  );
}

function assertAudienceFits(target: TargetIds, audience: AudienceCode) {
  if (!audienceFitsTarget(targetLevel(target), audience)) throw new DomainError(AUDIENCE_MISFIT);
}

const createSchema = contentSchema.and(
  z
    .object({
      // Explicit recipients (specific schools or classes): one copy each.
      mode: z.enum(["single", "several"]).default("single"),
      recipients: z.array(z.string().max(60)).max(MAX_RECIPIENTS, `${MAX_RECIPIENTS} destinataires au plus.`).default([]),
    })
    .superRefine((v, ctx) => {
      if (v.mode === "several" && !v.recipients.length) ctx.addIssue({ code: "custom", path: ["recipients"], message: "Cochez au moins un destinataire." });
    }),
);

export const createContent = createAction({
  permission: "content:create",
  schema: createSchema,
  handler: async (input, user) => {
    assertCanPublish(user, input);
    const targets = input.mode === "several" ? await resolveRecipientsForWrite(user, input.recipients) : [await resolveTargetForWrite(user, input.target)];
    for (const t of targets) assertAudienceFits(t, input.audience);
    const publish = input.intent === "publish";
    const now = new Date();
    const created = await db.$transaction(
      targets.map((target) =>
        db.content.create({ data: { ...contentData(input), ...target, authorId: user.id, status: publish ? "PUBLISHED" : "DRAFT", publishedAt: publish ? now : null } }),
      ),
    );
    for (const c of created) {
      await audit(user, {
        action: publish ? "publish" : "create",
        resource: "content",
        resourceId: c.id,
        summary: `${publish ? "Publication" : "Création"} du contenu « ${c.title} »${created.length > 1 ? ` (envoi à ${created.length} destinataires)` : ""}`,
        schoolId: c.schoolId,
      });
      if (publish) await notifyReaders(user, c);
    }
    invalidate(tags.contents);
    if (created.length === 1) redirect(`/espace/contenus/${created[0]!.id}`);
    redirect(`/espace/contenus?vue=geres&envoye=${created.length}`);
  },
});

export const updateContent = createAction({
  permission: "content:update",
  schema: contentSchema,
  handler: async (input, user) => {
    if (!input.id) throw new DomainError(NOT_FOUND);
    assertCanPublish(user, input);
    const current = await findManageable(user, input.id);
    const currentValue = current.classroomId
      ? `CLASSROOM:${current.classroomId}`
      : current.schoolId
        ? `SCHOOL:${current.schoolId}`
        : current.communeId
          ? `COMMUNE:${current.communeId}`
          : current.departmentId
            ? `DEPARTMENT:${current.departmentId}`
            : "NATIONAL";
    // An unchanged target is kept even when it is wider than what the editor
    // could pick today (a national editor fixing a school's typo).
    const target =
      input.target === currentValue
        ? { departmentId: current.departmentId, communeId: current.communeId, schoolId: current.schoolId, classroomId: current.classroomId }
        : await resolveTargetForWrite(user, input.target);
    assertAudienceFits(target, input.audience);
    const publish = input.intent === "publish" && current.status !== "PUBLISHED";
    const updated = await db.content.update({
      where: { id: current.id },
      data: { ...contentData(input), ...target, ...(publish ? { status: "PUBLISHED", publishedAt: new Date() } : {}) },
    });
    await audit(user, {
      action: publish ? "publish" : "update",
      resource: "content",
      resourceId: updated.id,
      summary: `${publish ? "Publication" : "Modification"} du contenu « ${updated.title} »`,
      schoolId: updated.schoolId,
    });
    if (publish) await notifyReaders(user, updated);
    invalidate(tags.contents);
    redirect(`/espace/contenus/${updated.id}`);
  },
});

const idSchema = z.object({ id: z.string().min(1).max(40) });

export const publishContent = createAction({
  permission: "content:publish",
  schema: idSchema,
  handler: async ({ id }, user) => {
    const current = await findManageable(user, id);
    if (current.status === "PUBLISHED") throw new DomainError("Ce contenu est déjà publié.");
    assertAudienceFits(current, current.audience);
    if ((current.mediaType === "AUDIO" || current.mediaType === "VIDEO") && !current.transcript)
      throw new DomainError("Ajoutez d'abord une transcription : les personnes sourdes ou malentendantes doivent pouvoir lire ce contenu.");
    const updated = await db.content.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await audit(user, { action: "publish", resource: "content", resourceId: id, summary: `Publication du contenu « ${updated.title} »`, schoolId: updated.schoolId });
    await notifyReaders(user, updated);
    invalidate(tags.contents);
    return "Contenu publié.";
  },
});

export const archiveContent = createAction({
  permission: "content:publish",
  schema: idSchema,
  handler: async ({ id }, user) => {
    const current = await findManageable(user, id);
    if (current.status === "ARCHIVED") throw new DomainError("Ce contenu est déjà archivé.");
    const updated = await db.content.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit(user, { action: "archive", resource: "content", resourceId: id, summary: `Archivage du contenu « ${updated.title} »`, schoolId: updated.schoolId });
    invalidate(tags.contents);
    return "Contenu archivé. Il n'est plus visible par les lecteurs.";
  },
});

export const deleteContent = createAction({
  permission: "content:delete",
  // The deleted card or page disappears with the refresh, so the result is
  // shown on the list the user returns to (?supprime=1).
  schema: idSchema.extend({
    returnTo: z
      .string()
      .regex(/^\/espace\/contenus(\?[\w\-=&%.+]*)?$/)
      .default("/espace/contenus"),
  }),
  handler: async ({ id, returnTo }, user) => {
    const current = await findManageable(user, id);
    // Publication notifications would lead readers to a missing page.
    await db.$transaction([
      db.notification.deleteMany({ where: { kind: "content", link: `/espace/contenus/${current.id}` } }),
      db.content.delete({ where: { id: current.id } }),
    ]);
    await audit(user, { action: "delete", resource: "content", resourceId: id, summary: `Suppression du contenu « ${current.title} »`, schoolId: current.schoolId });
    invalidate(tags.contents);
    const url = new URL(returnTo, "http://local");
    url.searchParams.delete("page");
    url.searchParams.set("supprime", "1");
    redirect(`${url.pathname}${url.search}`);
  },
});
