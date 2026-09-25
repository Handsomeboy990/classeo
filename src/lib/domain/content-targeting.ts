// Content targeting rules. Pure: no database, no framework, unit tested.
//
// A content with no target is national. Otherwise the most specific of
// classroom, school, commune and department applies. A reader receives a
// published content only when they are inside the target AND in its
// audience, for the same membership (see reaches()). A target reaches
// downwards, never upwards: a school announcement is for that school, not for
// the commune or the department above it. Supervisors follow what they
// supervise through managerReach(), in a separate "managed" view.

export type TargetLevel = "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "CLASSROOM";
export type AudienceCode = "EVERYONE" | "PARENTS" | "STUDENTS" | "TEACHERS" | "STAFF";
export type ScopeLevelCode = "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF";

export type TargetIds = {
  departmentId?: string | null;
  communeId?: string | null;
  schoolId?: string | null;
  classroomId?: string | null;
};

// A target whose ancestry is filled in: for a class target, the school,
// commune and department of that class are known too.
export type ResolvedTarget = {
  level: TargetLevel;
  departmentId: string | null;
  communeId: string | null;
  schoolId: string | null;
  classroomId: string | null;
};

// Where an editor can manage contents.
// - exact: a node whose own contents are in reach, but not what is inside it.
// - subtree: a node whose contents and everything inside it are in reach.
export type Reach = {
  all: boolean;
  exact: { departments: string[]; communes: string[]; schools: string[]; classrooms: string[] };
  subtree: { departments: string[]; communes: string[]; schools: string[] };
};

export function targetLevel(t: TargetIds): TargetLevel {
  if (t.classroomId) return "CLASSROOM";
  if (t.schoolId) return "SCHOOL";
  if (t.communeId) return "COMMUNE";
  if (t.departmentId) return "DEPARTMENT";
  return "NATIONAL";
}

function emptyReach(): Reach {
  return { all: false, exact: { departments: [], communes: [], schools: [], classrooms: [] }, subtree: { departments: [], communes: [], schools: [] } };
}

const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];

// A place in the territory, filled in upwards (a class knows its school,
// commune and department).
export type Position = { departmentId: string | null; communeId: string | null; schoolId: string | null; classroomId: string | null };

export type ReaderProfile = {
  level: ScopeLevelCode;
  departmentId: string | null;
  communeId: string | null;
  schoolId: string | null;
  isTeacher: boolean;
  // Structures with read only access to aggregates are nobody's audience:
  // they only receive what is addressed to everyone.
  isPartner?: boolean;
  // Classes a teacher teaches or leads.
  teacherClassroomIds?: string[];
  // Where the reader's children study (guardian), whatever the account's
  // own level: a teacher can also be a parent.
  children?: Position[];
  // Where the reader studies (student).
  own?: Position | null;
};

// What a reader is, and where, for one audience. A teacher is a teacher in
// their school and in each class they teach; a parent is a parent in each
// child's class. Pairing the audience with the position keeps a teacher who
// is also a parent from receiving the parents' messages of the school where
// they teach.
export type AudienceRole = "PARENT" | "STUDENT" | "TEACHER" | "STAFF" | "NONE";
export type Membership = { as: AudienceRole; at: Position };

const NATION: Position = { departmentId: null, communeId: null, schoolId: null, classroomId: null };

export function membershipsOf(p: ReaderProfile): Membership[] {
  const out: Membership[] = [];
  const dep: Position = { ...NATION, departmentId: p.departmentId };
  switch (p.level) {
    case "NATIONAL":
      out.push({ as: p.isPartner ? "NONE" : "STAFF", at: NATION });
      break;
    case "DEPARTMENT":
      if (p.departmentId) out.push({ as: "STAFF", at: dep });
      break;
    case "COMMUNE":
      if (p.communeId) out.push({ as: "STAFF", at: { ...dep, communeId: p.communeId } });
      break;
    case "SCHOOL": {
      if (!p.schoolId) break;
      const school: Position = { ...dep, communeId: p.communeId, schoolId: p.schoolId };
      if (p.isTeacher) {
        out.push({ as: "TEACHER", at: school });
        for (const classroomId of uniq(p.teacherClassroomIds ?? [])) out.push({ as: "TEACHER", at: { ...school, classroomId } });
      } else out.push({ as: "STAFF", at: school });
      break;
    }
    case "SELF":
      break;
  }
  for (const c of p.children ?? []) out.push({ as: "PARENT", at: c });
  if (p.own) out.push({ as: "STUDENT", at: p.own });
  return out;
}

const AUDIENCE_OF_ROLE: Record<AudienceRole, AudienceCode | null> = { PARENT: "PARENTS", STUDENT: "STUDENTS", TEACHER: "TEACHERS", STAFF: "STAFF", NONE: null };

// Whether a target covers a position: downwards only.
export function targetCovers(t: ResolvedTarget, at: Position): boolean {
  switch (t.level) {
    case "NATIONAL":
      return true;
    case "DEPARTMENT":
      return !!t.departmentId && at.departmentId === t.departmentId;
    case "COMMUNE":
      return !!t.communeId && at.communeId === t.communeId;
    case "SCHOOL":
      return !!t.schoolId && at.schoolId === t.schoolId;
    case "CLASSROOM":
      return !!t.classroomId && at.classroomId === t.classroomId;
  }
}

export function audienceIncludes(audience: AudienceCode, as: AudienceRole) {
  return audience === "EVERYONE" || AUDIENCE_OF_ROLE[as] === audience;
}

export type Addressed = { target: ResolvedTarget; audience: AudienceCode };

// The rule: a published content reaches a reader when one of the reader's
// memberships is both covered by the target and part of the audience.
export function reaches(c: Addressed, memberships: Membership[]) {
  return memberships.some((m) => audienceIncludes(c.audience, m.as) && targetCovers(c.target, m.at));
}

// The same rule as data, for the database filter: per audience role, the
// audiences that match and the exact targets that cover the positions. The
// query layer maps each group to one clause; readerGroupMatches() evaluates
// a group the same way, so the tests hold the filter to the rule.
export type ReaderGroup = {
  audiences: AudienceCode[];
  departments: string[];
  communes: string[];
  schools: string[];
  classrooms: string[];
};

export function readerGroups(memberships: Membership[]): ReaderGroup[] {
  const byRole = new Map<AudienceRole, Membership[]>();
  for (const m of memberships) byRole.set(m.as, [...(byRole.get(m.as) ?? []), m]);
  return [...byRole.entries()].map(([as, ms]) => {
    const own = AUDIENCE_OF_ROLE[as];
    return {
      audiences: own ? ["EVERYONE", own] : ["EVERYONE"],
      departments: uniq(ms.map((m) => m.at.departmentId)),
      communes: uniq(ms.map((m) => m.at.communeId)),
      schools: uniq(ms.map((m) => m.at.schoolId)),
      classrooms: uniq(ms.map((m) => m.at.classroomId)),
    };
  });
}

// National contents are covered by every group: every position is in Benin.
export function readerGroupMatches(g: ReaderGroup, c: Addressed) {
  if (!g.audiences.includes(c.audience)) return false;
  const t = c.target;
  switch (t.level) {
    case "NATIONAL":
      return true;
    case "DEPARTMENT":
      return !!t.departmentId && g.departments.includes(t.departmentId);
    case "COMMUNE":
      return !!t.communeId && g.communes.includes(t.communeId);
    case "SCHOOL":
      return !!t.schoolId && g.schools.includes(t.schoolId);
    case "CLASSROOM":
      return !!t.classroomId && g.classrooms.includes(t.classroomId);
  }
}

// Audiences that exist at a target level. A class has pupils, their parents
// and its teachers, but no administrative staff of its own: a class content
// "for the staff" would reach nobody.
export function audienceFitsTarget(level: TargetLevel, audience: AudienceCode) {
  return !(level === "CLASSROOM" && audience === "STAFF");
}

export const AUDIENCE_MISFIT = "Une classe n'a pas de personnel administratif : choisissez les parents, les élèves, les enseignants ou tout le monde.";

// Where an editor may manage contents (edit, publish, archive, delete),
// whatever their status or audience.
export function managerReach(p: Omit<ReaderProfile, "children" | "own">): Reach {
  const r = emptyReach();
  switch (p.level) {
    case "NATIONAL":
      r.all = true;
      return r;
    case "DEPARTMENT":
      r.subtree.departments = uniq([p.departmentId]);
      return r;
    case "COMMUNE":
      r.subtree.communes = uniq([p.communeId]);
      return r;
    case "SCHOOL":
      if (p.isTeacher) r.exact.classrooms = uniq(p.teacherClassroomIds ?? []);
      else r.subtree.schools = uniq([p.schoolId]);
      return r;
    case "SELF":
      return r;
  }
}

export function isInReach(reach: Reach, t: ResolvedTarget): boolean {
  if (reach.all) return true;
  const { exact, subtree } = reach;
  if (t.departmentId && subtree.departments.includes(t.departmentId)) return true;
  if (t.level !== "DEPARTMENT" && t.communeId && subtree.communes.includes(t.communeId)) return true;
  if ((t.level === "SCHOOL" || t.level === "CLASSROOM") && t.schoolId && subtree.schools.includes(t.schoolId)) return true;
  switch (t.level) {
    case "NATIONAL":
      return false;
    case "DEPARTMENT":
      return !!t.departmentId && exact.departments.includes(t.departmentId);
    case "COMMUNE":
      return !!t.communeId && exact.communes.includes(t.communeId);
    case "SCHOOL":
      return !!t.schoolId && exact.schools.includes(t.schoolId);
    case "CLASSROOM":
      return !!t.classroomId && exact.classrooms.includes(t.classroomId);
  }
}

// Only national editors manage national contents.
export function canManageTarget(reach: Reach, t: ResolvedTarget): boolean {
  return isInReach(reach, t);
}

// Target levels an author may choose when writing a content.
export function allowedTargetLevels(level: ScopeLevelCode, isTeacher: boolean): TargetLevel[] {
  switch (level) {
    case "NATIONAL":
      return ["NATIONAL", "DEPARTMENT"];
    case "DEPARTMENT":
      return ["DEPARTMENT", "COMMUNE"];
    case "COMMUNE":
      return ["COMMUNE", "SCHOOL"];
    case "SCHOOL":
      return isTeacher ? ["CLASSROOM"] : ["SCHOOL", "CLASSROOM"];
    case "SELF":
      return [];
  }
}

// Explicit recipients: the level of the several targets an author may pick
// at once instead of one (specific schools of a territory, specific classes
// of a school). Each recipient receives its own copy of the content.
export function recipientLevel(level: ScopeLevelCode): "SCHOOL" | "CLASSROOM" | null {
  switch (level) {
    case "NATIONAL":
    case "DEPARTMENT":
    case "COMMUNE":
      return "SCHOOL";
    case "SCHOOL":
      return "CLASSROOM";
    case "SELF":
      return null;
  }
}

export const MAX_RECIPIENTS = 50;

// A target choice travels in forms as "LEVEL" or "LEVEL:id".
export function parseTargetValue(value: string): { level: TargetLevel; id: string | null } | null {
  const [level, id, ...rest] = value.split(":");
  if (rest.length) return null;
  if (level === "NATIONAL") return id === undefined ? { level, id: null } : null;
  if (level === "DEPARTMENT" || level === "COMMUNE" || level === "SCHOOL" || level === "CLASSROOM") return id ? { level, id } : null;
  return null;
}

export function targetValue(t: TargetIds): string {
  const level = targetLevel(t);
  switch (level) {
    case "NATIONAL":
      return "NATIONAL";
    case "DEPARTMENT":
      return `DEPARTMENT:${t.departmentId}`;
    case "COMMUNE":
      return `COMMUNE:${t.communeId}`;
    case "SCHOOL":
      return `SCHOOL:${t.schoolId}`;
    case "CLASSROOM":
      return `CLASSROOM:${t.classroomId}`;
  }
}

export const AUDIENCE_LABELS: Record<AudienceCode, string> = {
  EVERYONE: "Tout le monde",
  PARENTS: "Parents",
  STUDENTS: "Élèves",
  TEACHERS: "Enseignants",
  STAFF: "Personnel",
};

export const TARGET_LEVEL_LABELS: Record<TargetLevel, string> = {
  NATIONAL: "National",
  DEPARTMENT: "Département",
  COMMUNE: "Commune",
  SCHOOL: "Établissement",
  CLASSROOM: "Classe",
};

// Media a deaf reader cannot follow without text.
export function requiresTranscript(mediaType: string) {
  return mediaType === "AUDIO" || mediaType === "VIDEO";
}
