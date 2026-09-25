// Content targeting rules. Pure: no database, no framework, unit tested.
//
// A content with no target is national. Otherwise the most specific of
// classroom, school, commune and department applies. A reader sees a
// published content when the target is inside their reach and the audience
// matches what they are (guardian, student, teacher, staff).

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

// Where a reader can see or an editor can manage contents.
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

export type Position = { departmentId: string | null; communeId: string | null; schoolId: string | null; classroomId: string | null };

export type ReaderProfile = {
  level: ScopeLevelCode;
  departmentId: string | null;
  communeId: string | null;
  schoolId: string | null;
  isTeacher: boolean;
  // Classes a teacher teaches or leads.
  teacherClassroomIds?: string[];
  // Where the reader's children (guardian) or the reader (student) study.
  family?: Position[];
};

// What a reader may read, by position in the territory.
export function readerReach(p: ReaderProfile): Reach {
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
      r.exact.departments = uniq([p.departmentId]);
      return r;
    case "SCHOOL":
      r.exact.departments = uniq([p.departmentId]);
      r.exact.communes = uniq([p.communeId]);
      if (p.isTeacher) {
        r.exact.schools = uniq([p.schoolId]);
        r.exact.classrooms = uniq(p.teacherClassroomIds ?? []);
      } else {
        r.subtree.schools = uniq([p.schoolId]);
      }
      return r;
    case "SELF": {
      const fam = p.family ?? [];
      r.exact.departments = uniq(fam.map((f) => f.departmentId));
      r.exact.communes = uniq(fam.map((f) => f.communeId));
      r.exact.schools = uniq(fam.map((f) => f.schoolId));
      r.exact.classrooms = uniq(fam.map((f) => f.classroomId));
      return r;
    }
  }
}

// Where an editor may manage contents (edit, publish, archive, delete),
// whatever their status or audience.
export function managerReach(p: Omit<ReaderProfile, "family">): Reach {
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

// National contents are in everyone's reach.
export function isInReach(reach: Reach, t: ResolvedTarget): boolean {
  if (reach.all || t.level === "NATIONAL") return true;
  const { exact, subtree } = reach;
  if (t.departmentId && subtree.departments.includes(t.departmentId)) return true;
  if (t.level !== "DEPARTMENT" && t.communeId && subtree.communes.includes(t.communeId)) return true;
  if ((t.level === "SCHOOL" || t.level === "CLASSROOM") && t.schoolId && subtree.schools.includes(t.schoolId)) return true;
  switch (t.level) {
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

// Management reach only: national users can target the nation too.
export function canManageTarget(reach: Reach, t: ResolvedTarget): boolean {
  if (reach.all) return true;
  if (t.level === "NATIONAL") return false;
  return isInReach(reach, t);
}

export type AudienceProfile = { level: ScopeLevelCode; isTeacher: boolean; isGuardian: boolean; isStudent: boolean; isPartner: boolean };

// The audiences a reader belongs to. EVERYONE always matches.
export function audiencesOf(p: AudienceProfile): AudienceCode[] {
  const out: AudienceCode[] = ["EVERYONE"];
  if (p.isGuardian) out.push("PARENTS");
  if (p.isStudent) out.push("STUDENTS");
  if (p.isTeacher) out.push("TEACHERS");
  if (p.level !== "SELF" && !p.isTeacher && !p.isPartner) out.push("STAFF");
  return out;
}

export function audienceMatches(audience: AudienceCode, audiences: AudienceCode[]) {
  return audience === "EVERYONE" || audiences.includes(audience);
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
