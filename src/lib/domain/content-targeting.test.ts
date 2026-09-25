import { describe, expect, it } from "vitest";

import {
  allowedTargetLevels,
  audienceMatches,
  audiencesOf,
  canManageTarget,
  isInReach,
  managerReach,
  parseTargetValue,
  readerReach,
  requiresTranscript,
  targetLevel,
  targetValue,
  type ResolvedTarget,
} from "./content-targeting";

// Territory used by the tests: department AQ > commune CAL > school CEG >
// classes 3A and 6B; department AQ > commune OUI > school EPP; department LT.
const national: ResolvedTarget = { level: "NATIONAL", departmentId: null, communeId: null, schoolId: null, classroomId: null };
const depAQ: ResolvedTarget = { level: "DEPARTMENT", departmentId: "AQ", communeId: null, schoolId: null, classroomId: null };
const depLT: ResolvedTarget = { level: "DEPARTMENT", departmentId: "LT", communeId: null, schoolId: null, classroomId: null };
const comCAL: ResolvedTarget = { level: "COMMUNE", departmentId: "AQ", communeId: "CAL", schoolId: null, classroomId: null };
const comOUI: ResolvedTarget = { level: "COMMUNE", departmentId: "AQ", communeId: "OUI", schoolId: null, classroomId: null };
const schCEG: ResolvedTarget = { level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", classroomId: null };
const schEPP: ResolvedTarget = { level: "SCHOOL", departmentId: "AQ", communeId: "OUI", schoolId: "EPP", classroomId: null };
const cls3A: ResolvedTarget = { level: "CLASSROOM", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", classroomId: "3A" };
const cls6B: ResolvedTarget = { level: "CLASSROOM", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", classroomId: "6B" };
const all = [national, depAQ, depLT, comCAL, comOUI, schCEG, schEPP, cls3A, cls6B];

const visible = (reach: ReturnType<typeof readerReach>) => all.filter((t) => isInReach(reach, t));

describe("targetLevel", () => {
  it("treats a content with no target as national", () => {
    expect(targetLevel({})).toBe("NATIONAL");
  });
  it("keeps the most specific target", () => {
    expect(targetLevel({ departmentId: "AQ", schoolId: "CEG" })).toBe("SCHOOL");
    expect(targetLevel({ schoolId: "CEG", classroomId: "3A" })).toBe("CLASSROOM");
    expect(targetLevel({ departmentId: "AQ", communeId: "CAL" })).toBe("COMMUNE");
  });
});

describe("readerReach", () => {
  it("lets national users see everything", () => {
    expect(visible(readerReach({ level: "NATIONAL", departmentId: null, communeId: null, schoolId: null, isTeacher: false }))).toEqual(all);
  });

  it("lets a department see its department, everything inside and national", () => {
    const r = readerReach({ level: "DEPARTMENT", departmentId: "AQ", communeId: null, schoolId: null, isTeacher: false });
    expect(visible(r)).toEqual([national, depAQ, comCAL, comOUI, schCEG, schEPP, cls3A, cls6B]);
  });

  it("lets a commune see inside itself, its department and national, not a sibling commune", () => {
    const r = readerReach({ level: "COMMUNE", departmentId: "AQ", communeId: "CAL", schoolId: null, isTeacher: false });
    expect(visible(r)).toEqual([national, depAQ, comCAL, schCEG, cls3A, cls6B]);
  });

  it("lets school staff see their school and its classes, commune, department and national", () => {
    const r = readerReach({ level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", isTeacher: false });
    expect(visible(r)).toEqual([national, depAQ, comCAL, schCEG, cls3A, cls6B]);
  });

  it("limits a teacher to the classes they teach", () => {
    const r = readerReach({ level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", isTeacher: true, teacherClassroomIds: ["3A"] });
    expect(visible(r)).toEqual([national, depAQ, comCAL, schCEG, cls3A]);
  });

  it("gives a parent the positions of every child", () => {
    const r = readerReach({
      level: "SELF",
      departmentId: null,
      communeId: null,
      schoolId: null,
      isTeacher: false,
      family: [
        { departmentId: "AQ", communeId: "CAL", schoolId: "CEG", classroomId: "3A" },
        { departmentId: "AQ", communeId: "OUI", schoolId: "EPP", classroomId: "CM1" },
      ],
    });
    expect(visible(r)).toEqual([national, depAQ, comCAL, comOUI, schCEG, schEPP, cls3A]);
  });

  it("gives a family with no enrolment only national contents", () => {
    const r = readerReach({ level: "SELF", departmentId: null, communeId: null, schoolId: null, isTeacher: false, family: [] });
    expect(visible(r)).toEqual([national]);
  });
});

describe("managerReach", () => {
  it("lets a national editor manage the nation", () => {
    const r = managerReach({ level: "NATIONAL", departmentId: null, communeId: null, schoolId: null, isTeacher: false });
    expect(canManageTarget(r, national)).toBe(true);
  });

  it("does not let a school director manage national or departmental contents", () => {
    const r = managerReach({ level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", isTeacher: false });
    expect(all.filter((t) => canManageTarget(r, t))).toEqual([schCEG, cls3A, cls6B]);
  });

  it("limits a teacher to their classes", () => {
    const r = managerReach({ level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", isTeacher: true, teacherClassroomIds: ["3A"] });
    expect(all.filter((t) => canManageTarget(r, t))).toEqual([cls3A]);
  });

  it("gives families nothing to manage", () => {
    const r = managerReach({ level: "SELF", departmentId: null, communeId: null, schoolId: null, isTeacher: false });
    expect(all.filter((t) => canManageTarget(r, t))).toEqual([]);
  });
});

describe("audiences", () => {
  it("matches parents, students, teachers and staff", () => {
    const parent = audiencesOf({ level: "SELF", isTeacher: false, isGuardian: true, isStudent: false, isPartner: false });
    expect(parent).toEqual(["EVERYONE", "PARENTS"]);
    expect(audienceMatches("PARENTS", parent)).toBe(true);
    expect(audienceMatches("TEACHERS", parent)).toBe(false);
    expect(audienceMatches("EVERYONE", [])).toBe(true);

    expect(audiencesOf({ level: "SCHOOL", isTeacher: true, isGuardian: false, isStudent: false, isPartner: false })).toEqual(["EVERYONE", "TEACHERS"]);
    expect(audiencesOf({ level: "DEPARTMENT", isTeacher: false, isGuardian: false, isStudent: false, isPartner: false })).toEqual(["EVERYONE", "STAFF"]);
    expect(audiencesOf({ level: "NATIONAL", isTeacher: false, isGuardian: false, isStudent: false, isPartner: true })).toEqual(["EVERYONE"]);
    expect(audiencesOf({ level: "SELF", isTeacher: false, isGuardian: false, isStudent: true, isPartner: false })).toEqual(["EVERYONE", "STUDENTS"]);
  });
});

describe("allowedTargetLevels", () => {
  it("limits authors to their own scope", () => {
    expect(allowedTargetLevels("NATIONAL", false)).toEqual(["NATIONAL", "DEPARTMENT"]);
    expect(allowedTargetLevels("DEPARTMENT", false)).toEqual(["DEPARTMENT", "COMMUNE"]);
    expect(allowedTargetLevels("COMMUNE", false)).toEqual(["COMMUNE", "SCHOOL"]);
    expect(allowedTargetLevels("SCHOOL", false)).toEqual(["SCHOOL", "CLASSROOM"]);
    expect(allowedTargetLevels("SCHOOL", true)).toEqual(["CLASSROOM"]);
    expect(allowedTargetLevels("SELF", false)).toEqual([]);
  });
});

describe("target values", () => {
  it("round trips through the form value", () => {
    expect(parseTargetValue("NATIONAL")).toEqual({ level: "NATIONAL", id: null });
    expect(parseTargetValue("SCHOOL:abc")).toEqual({ level: "SCHOOL", id: "abc" });
    expect(targetValue({ schoolId: "CEG", classroomId: "3A" })).toBe("CLASSROOM:3A");
    expect(targetValue({})).toBe("NATIONAL");
  });
  it("rejects malformed values", () => {
    expect(parseTargetValue("SCHOOL")).toBeNull();
    expect(parseTargetValue("NATIONAL:x")).toBeNull();
    expect(parseTargetValue("PLANET:x")).toBeNull();
    expect(parseTargetValue("SCHOOL:a:b")).toBeNull();
  });
});

describe("requiresTranscript", () => {
  it("requires text for audio and video only", () => {
    expect(requiresTranscript("AUDIO")).toBe(true);
    expect(requiresTranscript("VIDEO")).toBe(true);
    expect(requiresTranscript("IMAGE")).toBe(false);
    expect(requiresTranscript("NONE")).toBe(false);
  });
});
