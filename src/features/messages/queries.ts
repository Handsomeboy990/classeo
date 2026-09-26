import "server-only";

import type { PickerOption } from "@/components/kit/multi-picker";
import type { Prisma } from "@/generated/prisma/client";
import { can, ForbiddenError } from "@/lib/auth/authorize";
import { enrollmentWhere, isTeacherRole, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  actingInstitution,
  canCorrespond,
  departmentInstitution,
  INSTITUTION_GROUPS,
  institutionKey,
  institutionName,
  mailboxUsername,
  MAILBOX_ROLE_CODE,
  MAX_INSTITUTION_RECIPIENTS,
  MINISTRY,
  MINISTRY_ID,
  parseInstitutionKey,
  parseDepartmentInstitutionId,
  parseMailboxUsername,
  partyOfAuthor,
  type Institution,
  type InstitutionKind,
} from "@/lib/domain/institutions";

import { chainOfCycle, DIRECTION_OF, type Chain } from "@/lib/domain/chains";

import { activeYearId } from "../contents/queries";

const CHAINS: Chain[] = ["PRIMARY", "SECONDARY"];
import { roleLabel } from "./role-label";

type User = NonNullable<CurrentUser>;

// family: a parent or student account, never put in a shared conversation
// with other people (see recipients.ts).
export type Contact = { id: string; name: string; group: string; detail: string; family: boolean };

const contactSelect = {
  id: true,
  firstName: true,
  lastName: true,
  scopeLevel: true,
  role: { select: { name: true } },
  school: { select: { name: true } },
} satisfies Prisma.UserSelect;

type ContactRow = Prisma.UserGetPayload<{ select: typeof contactSelect }>;

// A director is identified by what they may do, not by a role name: school
// level accounts allowed to manage the school.
const isDirector: Prisma.UserWhereInput = { scopeLevel: "SCHOOL", role: { permissions: { some: { permission: { code: "school:update" } } } } };

const LIMIT = 300;

async function users(where: Prisma.UserWhereInput, group: (u: ContactRow) => string): Promise<Contact[]> {
  const rows = await db.user.findMany({ where: { AND: [where, { isActive: true }] }, select: contactSelect, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: LIMIT });
  return rows.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, group: group(u), detail: [u.role.name, u.school?.name].filter(Boolean).join(", "), family: u.scopeLevel === "SELF" }));
}

// Who the user may start a conversation with, person to person.
// - parent: teachers of their children's classes and directors of those schools
// - student: teachers of their class
// - teacher: guardians of their students and staff of their school
// - school staff: users of their school and guardians of its students
// - commune, department, nation: school directors in their scope
export async function allowedContacts(user: User): Promise<Contact[]> {
  const yearId = await activeYearId();
  const notMe = { id: { not: user.id } };
  const byRole = (u: ContactRow) => u.role.name;
  let lists: Contact[][] = [];

  if (user.scope.level === "SELF") {
    const who: Prisma.EnrollmentWhereInput | null = user.guardianId
      ? { student: { guardians: { some: { guardianId: user.guardianId } } } }
      : user.studentId
        ? { studentId: user.studentId }
        : null;
    if (!who) return [];
    const enrollments = await db.enrollment.findMany({ where: { AND: [who, { academicYearId: yearId, status: "ACTIVE" }] }, select: { classroomId: true, schoolId: true } });
    const classroomIds = enrollments.map((e) => e.classroomId);
    const schoolIds = [...new Set(enrollments.map((e) => e.schoolId))];
    if (!classroomIds.length) return [];
    const teachers = users(
      { AND: [notMe, { teachers: { some: { OR: [{ assignments: { some: { classroomId: { in: classroomIds } } } }, { mainClasses: { some: { id: { in: classroomIds } } } }] } } }] },
      () => "Enseignants",
    );
    lists = await Promise.all(user.guardianId ? [teachers, users({ AND: [notMe, isDirector, { schoolId: { in: schoolIds } }] }, () => "Direction")] : [teachers]);
  } else if (user.scope.level === "SCHOOL") {
    const schoolId = user.scope.schoolId ?? "__none__";
    const guardianWhere: Prisma.UserWhereInput = {
      guardian: { students: { some: { student: { enrollments: { some: { AND: [enrollmentWhere(user), { academicYearId: yearId, status: "ACTIVE" }] } } } } } },
    };
    lists = await Promise.all([
      users({ AND: [notMe, { schoolId, scopeLevel: "SCHOOL" }] }, byRole),
      users(guardianWhere, () => (user.teacherId ? "Parents de vos élèves" : "Parents d'élèves")),
    ]);
  } else {
    lists = [await users({ AND: [notMe, isDirector, { school: schoolWhere(user) }] }, () => "Chefs d'établissement")];
  }

  const seen = new Set<string>();
  return lists.flat().filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------

// The institution the user reads and writes for, if any.
export function institutionOf(user: User): Institution | null {
  return actingInstitution({
    level: user.scope.level,
    departmentId: user.scope.departmentId,
    communeId: user.scope.communeId,
    schoolId: user.scope.schoolId,
    chain: user.scope.chain,
    schoolCycle: user.scope.cycle,
    isTeacher: isTeacherRole(user),
    canViewMessages: can(user, "message:view"),
  });
}

// The user's side of a conversation: their own participation, or the
// mailbox of the institution they work for.
function sideWhere(user: User): Prisma.ConversationParticipantWhereInput {
  const inst = institutionOf(user);
  return inst ? { OR: [{ userId: user.id }, { user: { username: mailboxUsername(inst) } }] } : { userId: user.id };
}

// Only a participant, or the staff of a participating institution, can
// reach a thread: the filter is part of every lookup.
export function conversationWhere(user: User): Prisma.ConversationWhereInput {
  return { participants: { some: sideWhere(user) } };
}

export const partySelect = {
  userId: true,
  lastReadAt: true,
  user: {
    select: {
      username: true,
      firstName: true,
      lastName: true,
      gender: true,
      role: { select: { name: true } },
      school: { select: { name: true } },
      commune: { select: { name: true } },
      department: { select: { name: true } },
    },
  },
} satisfies Prisma.ConversationParticipantSelect;

type ParticipantRow = Prisma.ConversationParticipantGetPayload<{ select: typeof partySelect }>;

export type Party = {
  userId: string;
  // "PERSON", or the kind of institution the mailbox stands for.
  kind: "PERSON" | InstitutionKind;
  institutionId: string | null;
  name: string;
  detail: string;
  gender: "F" | "M" | null;
  lastReadAt: Date | null;
};

const INSTITUTION_DETAIL: Record<InstitutionKind, string> = {
  MINISTRY: "MEMP et MESTFP, administration centrale",
  DEPARTMENT: "Direction départementale",
  COMMUNE: "Circonscription scolaire, maternelle et primaire",
  SCHOOL: "Établissement",
};

function institutionDetail(kind: InstitutionKind, id: string) {
  if (kind !== "DEPARTMENT") return INSTITUTION_DETAIL[kind];
  const { chain } = parseDepartmentInstitutionId(id);
  return chain ? DIRECTION_OF[chain].name : INSTITUTION_DETAIL.DEPARTMENT;
}

function toParty(p: ParticipantRow): Party {
  const u = p.user;
  const mailbox = parseMailboxUsername(u.username);
  if (mailbox) {
    const place = mailbox.kind === "SCHOOL" ? u.school?.name : mailbox.kind === "COMMUNE" ? u.commune?.name : u.department?.name;
    const chain = mailbox.kind === "DEPARTMENT" ? parseDepartmentInstitutionId(mailbox.id).chain : null;
    return {
      userId: p.userId,
      kind: mailbox.kind,
      institutionId: mailbox.id,
      name: institutionName(mailbox.kind, place, chain),
      detail: institutionDetail(mailbox.kind, mailbox.id),
      gender: null,
      lastReadAt: p.lastReadAt,
    };
  }
  return {
    userId: p.userId,
    kind: "PERSON",
    institutionId: null,
    name: `${u.firstName} ${u.lastName}`,
    detail: [roleLabel(u.role.name, u.gender), u.school?.name].filter(Boolean).join(", "),
    gender: u.gender,
    lastReadAt: p.lastReadAt,
  };
}

// Splits the participants into the user's side and the other parties.
export function sides(user: User, participants: ParticipantRow[]) {
  const inst = institutionOf(user);
  const mailbox = inst ? mailboxUsername(inst) : null;
  const parties = participants.map((p) => ({ row: p, party: toParty(p) }));
  const mine = parties.find((p) => p.row.userId === user.id) ?? parties.find((p) => p.row.user.username === mailbox) ?? null;
  return { me: mine?.party ?? null, others: parties.filter((p) => p !== mine).map((p) => p.party) };
}

const authorSelect = {
  firstName: true,
  lastName: true,
  scopeLevel: true,
  departmentId: true,
  communeId: true,
  schoolId: true,
  chain: true,
  commune: { select: { departmentId: true } },
  school: { select: { communeId: true, commune: { select: { departmentId: true } } } },
} satisfies Prisma.UserSelect;

type AuthorRow = Prisma.UserGetPayload<{ select: typeof authorSelect }>;

// The institution a message was written for, from where its author works.
export function authorParty(author: AuthorRow, parties: Party[]) {
  const institutions = parties.filter((p) => p.kind !== "PERSON").map((p) => ({ kind: p.kind as InstitutionKind, id: p.institutionId! }));
  if (!institutions.length) return null;
  const found = partyOfAuthor(
    {
      level: author.scopeLevel,
      departmentId: author.departmentId ?? author.commune?.departmentId ?? author.school?.commune.departmentId ?? null,
      communeId: author.communeId ?? author.school?.communeId ?? null,
      schoolId: author.schoolId,
      chain: author.chain,
    },
    institutions,
  );
  return found ? (parties.find((p) => p.kind === found.kind && p.institutionId === found.id) ?? null) : null;
}

// Whether a message comes from the user's side: written by the user, or by
// a colleague for the same institution.
export function fromMySide(user: User, me: Party | null, message: { senderId: string; sender: AuthorRow }, parties: Party[]) {
  if (message.senderId === user.id) return true;
  if (!me || me.kind === "PERSON") return false;
  return authorParty(message.sender, parties)?.userId === me.userId;
}

export async function listConversations(user: User) {
  const rows = await db.conversation.findMany({
    where: conversationWhere(user),
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      participants: { select: partySelect },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, audioFileId: true, audioDurationMs: true, createdAt: true, senderId: true, sender: { select: authorSelect } } },
    },
  });
  return rows.map((c) => {
    const { me, others } = sides(user, c.participants);
    const last = c.messages[0] ?? null;
    const mineLast = last ? fromMySide(user, me, last, [...(me ? [me] : []), ...others]) : false;
    return {
      id: c.id,
      subject: c.subject,
      me,
      others,
      last,
      lastIsMine: mineLast,
      unread: !!last && !mineLast && (!me?.lastReadAt || last.createdAt > me.lastReadAt),
    };
  });
}

export type ConversationSummary = Awaited<ReturnType<typeof listConversations>>[number];

export async function getThread(user: User, id: string) {
  const c = await db.conversation.findFirst({
    where: { AND: [{ id }, conversationWhere(user)] },
    include: {
      participants: { select: partySelect },
      messages: { orderBy: { createdAt: "desc" }, take: 200, select: { id: true, body: true, audioFileId: true, audioDurationMs: true, createdAt: true, senderId: true, sender: { select: authorSelect } } },
    },
  });
  if (!c) return null;
  const { me, others } = sides(user, c.participants);
  const parties = [...(me ? [me] : []), ...others];
  const messages = [...c.messages].reverse().map((m) => ({
    id: m.id,
    body: m.body,
    // A voice note: played from /api/files, which checks participation again.
    audio: m.audioFileId ? { url: `/api/files/${m.audioFileId}`, durationMs: m.audioDurationMs ?? 0 } : null,
    createdAt: m.createdAt,
    mine: m.senderId === user.id,
    mySide: fromMySide(user, me, m, parties),
    author: `${m.sender.firstName} ${m.sender.lastName}`,
    // The institution the author wrote for, in an institutional thread.
    on: authorParty(m.sender, parties)?.name ?? null,
  }));
  const lastMine = [...messages].reverse().find((m) => m.mySide)?.createdAt ?? null;
  return { id: c.id, subject: c.subject, me, others, messages, lastMine, institutional: parties.some((p) => p.kind !== "PERSON") };
}

// Opening a thread marks it read for the user's side: for an institution,
// the read receipt its correspondents see.
export async function markThreadRead(user: User, thread: { id: string; me: Party | null }) {
  const now = new Date();
  await db.$transaction([
    ...(thread.me ? [db.conversationParticipant.update({ where: { conversationId_userId: { conversationId: thread.id, userId: thread.me.userId } }, data: { lastReadAt: now } })] : []),
    db.notification.updateMany({ where: { userId: user.id, readAt: null, link: `/espace/messages/${thread.id}` }, data: { readAt: now } }),
  ]);
}

// The institutions the user's institution may write to, for the picker.
// Every department has two directions, a DDEMP and a DDESTFP.
export async function institutionDirectory(user: User): Promise<PickerOption[]> {
  const me = institutionOf(user);
  if (!me) return [];
  const national = me.kind === "MINISTRY";
  const dep = me.departmentId ?? "__none__";
  const [departments, communes, schools] = await Promise.all([
    me.kind === "DEPARTMENT" ? [] : db.department.findMany({ where: national ? {} : { id: dep }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    me.kind === "COMMUNE"
      ? []
      : db.commune.findMany({
          where: national ? {} : me.kind === "DEPARTMENT" ? { departmentId: dep } : { id: me.communeId ?? "__none__" },
          select: { id: true, name: true, departmentId: true, department: { select: { name: true } } },
          orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
        }),
    db.school.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        ...(me.kind === "DEPARTMENT" ? { commune: { departmentId: dep } } : me.kind === "COMMUNE" ? { communeId: me.communeId ?? "__none__" } : {}),
      },
      select: { id: true, name: true, communeId: true, cycle: true, commune: { select: { name: true, departmentId: true } } },
      orderBy: [{ commune: { name: "asc" } }, { name: "asc" }],
      take: 3000,
    }),
  ]);
  const all: { i: Institution; label: string; detail?: string }[] = [
    { i: MINISTRY, label: institutionName("MINISTRY", null) },
    ...departments.flatMap((d) =>
      CHAINS.map((chain) => ({ i: departmentInstitution(d.id, chain), label: institutionName("DEPARTMENT", d.name, chain), detail: DIRECTION_OF[chain].name })),
    ),
    ...communes.map((c) => ({ i: { kind: "COMMUNE" as const, id: c.id, departmentId: c.departmentId, communeId: c.id, chain: "PRIMARY" as const }, label: institutionName("COMMUNE", c.name), detail: `Département ${c.department.name}` })),
    ...schools.map((s) => ({ i: { kind: "SCHOOL" as const, id: s.id, departmentId: s.commune.departmentId, communeId: s.communeId, chain: chainOfCycle(s.cycle) }, label: s.name, detail: s.commune.name })),
  ];
  return all.filter((x) => canCorrespond(me, x.i)).map((x) => ({ value: institutionKey(x.i), label: x.label, group: INSTITUTION_GROUPS[x.i.kind], detail: x.detail }));
}

export type NamedInstitution = Institution & { name: string };

const NOT_ALLOWED = "Votre établissement ou service ne peut pas écrire à l'un des destinataires choisis.";

// Checks picked recipients against the routes, with scoped lookups: every
// key must resolve and be allowed, or nothing is sent.
export async function resolveInstitutions(user: User, keys: string[]): Promise<{ from: NamedInstitution; to: NamedInstitution[] }> {
  const me = institutionOf(user);
  if (!me) throw new ForbiddenError("Votre compte n'écrit pas au nom d'un établissement ou d'un service.");
  const unique = [...new Set(keys)];
  if (!unique.length || unique.length > MAX_INSTITUTION_RECIPIENTS) throw new ForbiddenError(NOT_ALLOWED);
  const parsed = unique.map(parseInstitutionKey);
  if (parsed.some((p) => !p)) throw new ForbiddenError(NOT_ALLOWED);
  const ids = (k: InstitutionKind) => parsed.filter((p) => p!.kind === k).map((p) => p!.id);
  const departmentIds = [...ids("DEPARTMENT"), ...(me.kind === "DEPARTMENT" ? [me.id] : [])].map((i) => parseDepartmentInstitutionId(i).departmentId);
  const [departments, communes, schools] = await Promise.all([
    db.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } }),
    db.commune.findMany({ where: { id: { in: [...ids("COMMUNE"), ...(me.kind === "COMMUNE" ? [me.id] : [])] } }, select: { id: true, name: true, departmentId: true } }),
    db.school.findMany({
      where: { OR: [{ id: { in: ids("SCHOOL") }, isActive: true, status: "ACTIVE" }, ...(me.kind === "SCHOOL" ? [{ id: me.id }] : [])] },
      select: { id: true, name: true, communeId: true, cycle: true, commune: { select: { departmentId: true } } },
    }),
  ]);
  const named = (i: { kind: InstitutionKind; id: string }): NamedInstitution | null => {
    if (i.kind === "MINISTRY") return i.id === MINISTRY_ID ? { ...MINISTRY, name: institutionName("MINISTRY", null) } : null;
    if (i.kind === "DEPARTMENT") {
      const { departmentId, chain } = parseDepartmentInstitutionId(i.id);
      const d = departments.find((x) => x.id === departmentId);
      return d ? { ...departmentInstitution(d.id, chain), name: institutionName("DEPARTMENT", d.name, chain) } : null;
    }
    if (i.kind === "COMMUNE") {
      const c = communes.find((x) => x.id === i.id);
      return c ? { kind: "COMMUNE", id: c.id, departmentId: c.departmentId, communeId: c.id, chain: "PRIMARY", name: institutionName("COMMUNE", c.name) } : null;
    }
    const s = schools.find((x) => x.id === i.id);
    return s ? { kind: "SCHOOL", id: s.id, departmentId: s.commune.departmentId, communeId: s.communeId, chain: chainOfCycle(s.cycle), name: s.name } : null;
  };
  const from = named(me);
  const to = parsed.map((p) => named(p!));
  if (!from || to.some((t) => !t || !canCorrespond(me, t))) throw new ForbiddenError(NOT_ALLOWED);
  return { from, to: to as NamedInstitution[] };
}

// The mailbox account standing for an institution in conversations, created
// on first use. It can never sign in: inactive, no usable password, and a
// role without any permission.
export async function ensureMailbox(i: NamedInstitution): Promise<string> {
  const role = await db.role.upsert({
    where: { code: MAILBOX_ROLE_CODE },
    update: {},
    create: {
      code: MAILBOX_ROLE_CODE,
      name: "Boîte de messagerie d'institution",
      description: "Compte technique sans connexion qui représente un établissement ou un service dans la messagerie.",
      scopeLevel: "NATIONAL",
      isSystem: true,
    },
    select: { id: true },
  });
  const username = mailboxUsername(i);
  const place = {
    scopeLevel: i.kind === "MINISTRY" ? ("NATIONAL" as const) : i.kind,
    departmentId: i.kind === "DEPARTMENT" ? i.departmentId : null,
    communeId: i.kind === "COMMUNE" ? i.id : null,
    schoolId: i.kind === "SCHOOL" ? i.id : null,
  };
  try {
    const u = await db.user.upsert({
      where: { username },
      update: { firstName: i.name },
      create: { username, firstName: i.name, lastName: "", passwordHash: "!", isActive: false, roleId: role.id, ...place },
      select: { id: true },
    });
    return u.id;
  } catch {
    // Two first messages at the same time: the other request created it.
    const u = await db.user.findUniqueOrThrow({ where: { username }, select: { id: true } });
    return u.id;
  }
}

// The accounts of a direction: those of its chain, and those without one.
function departmentStaffWhere(id: string): Prisma.UserWhereInput {
  const { departmentId, chain } = parseDepartmentInstitutionId(id);
  return { scopeLevel: "DEPARTMENT", departmentId, ...(chain ? { OR: [{ chain: null }, { chain }] } : {}) };
}

// The people who read an institution's mail: active accounts at its own
// level whose role holds message:view (teachers write as themselves).
export async function staffOf(i: Pick<Institution, "kind" | "id">): Promise<string[]> {
  const where: Prisma.UserWhereInput =
    i.kind === "MINISTRY"
      ? { scopeLevel: "NATIONAL" }
      : i.kind === "DEPARTMENT"
        ? departmentStaffWhere(i.id)
        : i.kind === "COMMUNE"
          ? { scopeLevel: "COMMUNE", communeId: i.id }
          : { scopeLevel: "SCHOOL", schoolId: i.id, role: { code: { not: "TEACHER" } } };
  const rows = await db.user.findMany({
    where: { AND: [where, { isActive: true, role: { permissions: { some: { permission: { code: "message:view" } } } } }] },
    select: { id: true },
    take: 200,
  });
  return rows.map((r) => r.id);
}

