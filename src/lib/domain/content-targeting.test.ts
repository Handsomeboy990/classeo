import { describe, expect, it } from "vitest";

import {
  allowedTargetLevels,
  audienceFitsTarget,
  canManageTarget,
  managerReach,
  membershipsOf,
  parseTargetValue,
  reaches,
  readerGroupMatches,
  readerGroups,
  recipientLevel,
  requiresTranscript,
  targetLevel,
  targetValue,
  type AudienceCode,
  type ReaderProfile,
  type ResolvedTarget,
} from "./content-targeting";

// Territory used by the tests: department AQ > commune CAL > school CEG >
// classes 3A and 6B; department AQ > commune OUI > school EPP > class CM1;
// department LT, with nothing inside.
const T = {
  national: { level: "NATIONAL", departmentId: null, communeId: null, schoolId: null, classroomId: null },
  depAQ: { level: "DEPARTMENT", departmentId: "AQ", communeId: null, schoolId: null, classroomId: null },
  depLT: { level: "DEPARTMENT", departmentId: "LT", communeId: null, schoolId: null, classroomId: null },
  comCAL: { level: "COMMUNE", departmentId: "AQ", communeId: "CAL", schoolId: null, classroomId: null },
  comOUI: { level: "COMMUNE", departmentId: "AQ", communeId: "OUI", schoolId: null, classroomId: null },
  schCEG: { level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", classroomId: null },
  schEPP: { level: "SCHOOL", departmentId: "AQ", communeId: "OUI", schoolId: "EPP", classroomId: null },
  cls3A: { level: "CLASSROOM", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", classroomId: "3A" },
  cls6B: { level: "CLASSROOM", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", classroomId: "6B" },
} satisfies Record<string, ResolvedTarget>;
type TargetName = keyof typeof T;
const TARGETS = Object.keys(T) as TargetName[];
const AUDIENCES: AudienceCode[] = ["EVERYONE", "PARENTS", "STUDENTS", "TEACHERS", "STAFF"];

const in3A = { departmentId: "AQ", communeId: "CAL", schoolId: "CEG", classroomId: "3A" };
const inCM1 = { departmentId: "AQ", communeId: "OUI", schoolId: "EPP", classroomId: "CM1" };
const base = { departmentId: null, communeId: null, schoolId: null, isTeacher: false };

const R = {
  minister: { ...base, level: "NATIONAL" },
  partner: { ...base, level: "NATIONAL", isPartner: true },
  directorAQ: { ...base, level: "DEPARTMENT", departmentId: "AQ" },
  inspectorCAL: { ...base, level: "COMMUNE", departmentId: "AQ", communeId: "CAL" },
  secretaryCEG: { ...base, level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG" },
  teacher3A: { ...base, level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", isTeacher: true, teacherClassroomIds: ["3A"] },
  unlinkedTeacher: { ...base, level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", isTeacher: true },
  teacherParent: { ...base, level: "SCHOOL", departmentId: "AQ", communeId: "CAL", schoolId: "CEG", isTeacher: true, teacherClassroomIds: ["6B"], children: [inCM1] },
  parent3A: { ...base, level: "SELF", children: [in3A] },
  parentTwo: { ...base, level: "SELF", children: [in3A, inCM1] },
  student3A: { ...base, level: "SELF", own: in3A },
  familyNoEnrolment: { ...base, level: "SELF", children: [] },
} satisfies Record<string, ReaderProfile>;
type ReaderName = keyof typeof R;

// Expected reception, written by hand from the owner's rule ("only those it
// is meant for"): for each reader, the audiences they receive per target.
// Anything absent is not received.
const E = "EVERYONE" as const;
const family = (a: "PARENTS" | "STUDENTS") => [E, a];
const EXPECTED: Record<ReaderName, Partial<Record<TargetName, AudienceCode[]>>> = {
  minister: { national: [E, "STAFF"] },
  partner: { national: [E] },
  directorAQ: { national: [E, "STAFF"], depAQ: [E, "STAFF"] },
  inspectorCAL: { national: [E, "STAFF"], depAQ: [E, "STAFF"], comCAL: [E, "STAFF"] },
  secretaryCEG: { national: [E, "STAFF"], depAQ: [E, "STAFF"], comCAL: [E, "STAFF"], schCEG: [E, "STAFF"] },
  teacher3A: { national: [E, "TEACHERS"], depAQ: [E, "TEACHERS"], comCAL: [E, "TEACHERS"], schCEG: [E, "TEACHERS"], cls3A: [E, "TEACHERS"] },
  unlinkedTeacher: { national: [E, "TEACHERS"], depAQ: [E, "TEACHERS"], comCAL: [E, "TEACHERS"], schCEG: [E, "TEACHERS"] },
  // Teacher at CEG (class 6B), parent of a pupil of EPP: parents' contents
  // of EPP reach them, parents' contents of CEG do not.
  teacherParent: {
    national: [E, "PARENTS", "TEACHERS"],
    depAQ: [E, "PARENTS", "TEACHERS"],
    comCAL: [E, "TEACHERS"],
    comOUI: [E, "PARENTS"],
    schCEG: [E, "TEACHERS"],
    schEPP: [E, "PARENTS"],
    cls6B: [E, "TEACHERS"],
  },
  parent3A: { national: family("PARENTS"), depAQ: family("PARENTS"), comCAL: family("PARENTS"), schCEG: family("PARENTS"), cls3A: family("PARENTS") },
  parentTwo: {
    national: family("PARENTS"),
    depAQ: family("PARENTS"),
    comCAL: family("PARENTS"),
    comOUI: family("PARENTS"),
    schCEG: family("PARENTS"),
    schEPP: family("PARENTS"),
    cls3A: family("PARENTS"),
  },
  student3A: { national: family("STUDENTS"), depAQ: family("STUDENTS"), comCAL: family("STUDENTS"), schCEG: family("STUDENTS"), cls3A: family("STUDENTS") },
  familyNoEnrolment: {},
};

const cases = (Object.keys(R) as ReaderName[]).flatMap((reader) =>
  TARGETS.flatMap((target) => AUDIENCES.map((audience) => ({ reader, target, audience, expected: (EXPECTED[reader][target] ?? []).includes(audience) }))),
);

describe("reaches: every reader, target and audience", () => {
  it.each(cases)("$reader, $target for $audience: $expected", ({ reader, target, audience, expected }) => {
    const ms = membershipsOf(R[reader]);
    const content = { target: T[target], audience };
    expect(reaches(content, ms)).toBe(expected);
    // The database filter is built from the groups: it must agree with the rule.
    expect(readerGroups(ms).some((g) => readerGroupMatches(g, content))).toBe(expected);
  });
});

describe("the owner's examples", () => {
  const got = (reader: ReaderName, target: TargetName, audience: AudienceCode) => reaches({ target: T[target], audience }, membershipsOf(R[reader]));
  it("keeps a national announcement for teachers away from parents and pupils", () => {
    expect(got("teacher3A", "national", "TEACHERS")).toBe(true);
    expect(got("parent3A", "national", "TEACHERS")).toBe(false);
    expect(got("student3A", "national", "TEACHERS")).toBe(false);
  });
  it("gives a class resource only to its pupils, their parents and its teachers", () => {
    const reached = (Object.keys(R) as ReaderName[]).filter((r) => got(r, "cls3A", "EVERYONE"));
    expect(reached).toEqual(["teacher3A", "parent3A", "parentTwo", "student3A"]);
  });
  it("does not send a school's contents up to the commune, the department or the ministry", () => {
    expect(got("inspectorCAL", "schCEG", "EVERYONE")).toBe(false);
    expect(got("directorAQ", "schCEG", "EVERYONE")).toBe(false);
    expect(got("minister", "schCEG", "EVERYONE")).toBe(false);
  });
  it("keeps a department's contents inside that department", () => {
    expect(got("secretaryCEG", "depLT", "EVERYONE")).toBe(false);
    expect(got("parentTwo", "depLT", "EVERYONE")).toBe(false);
  });
});

describe("membershipsOf", () => {
  it("fails closed on an incomplete scope", () => {
    expect(membershipsOf({ ...base, level: "DEPARTMENT" })).toEqual([]);
    expect(membershipsOf({ ...base, level: "COMMUNE" })).toEqual([]);
    expect(membershipsOf({ ...base, level: "SCHOOL" })).toEqual([]);
    expect(membershipsOf({ ...base, level: "SELF" })).toEqual([]);
  });
});

describe("audienceFitsTarget", () => {
  it.each([
    ["CLASSROOM", "STAFF", false],
    ["CLASSROOM", "PARENTS", true],
    ["CLASSROOM", "EVERYONE", true],
    ["SCHOOL", "STAFF", true],
    ["NATIONAL", "STAFF", true],
  ] as const)("%s for %s: %s", (level, audience, ok) => {
    expect(audienceFitsTarget(level, audience)).toBe(ok);
  });
});

describe("managerReach", () => {
  const manageable = (p: ReaderProfile) => TARGETS.filter((t) => canManageTarget(managerReach(p), T[t]));
  it.each([
    ["minister", TARGETS],
    ["directorAQ", ["depAQ", "comCAL", "comOUI", "schCEG", "schEPP", "cls3A", "cls6B"]],
    ["inspectorCAL", ["comCAL", "schCEG", "cls3A", "cls6B"]],
    ["secretaryCEG", ["schCEG", "cls3A", "cls6B"]],
    ["teacher3A", ["cls3A"]],
    ["unlinkedTeacher", []],
    ["parent3A", []],
  ] as [ReaderName, TargetName[]][])("%s manages %j", (reader, expected) => {
    expect(manageable(R[reader])).toEqual(expected);
  });
});

describe("targetLevel", () => {
  it("treats a content with no target as national and keeps the most specific target", () => {
    expect(targetLevel({})).toBe("NATIONAL");
    expect(targetLevel({ departmentId: "AQ", schoolId: "CEG" })).toBe("SCHOOL");
    expect(targetLevel({ schoolId: "CEG", classroomId: "3A" })).toBe("CLASSROOM");
    expect(targetLevel({ departmentId: "AQ", communeId: "CAL" })).toBe("COMMUNE");
  });
});

describe("allowedTargetLevels and recipientLevel", () => {
  it.each([
    ["NATIONAL", false, ["NATIONAL", "DEPARTMENT"], "SCHOOL"],
    ["DEPARTMENT", false, ["DEPARTMENT", "COMMUNE"], "SCHOOL"],
    ["COMMUNE", false, ["COMMUNE", "SCHOOL"], "SCHOOL"],
    ["SCHOOL", false, ["SCHOOL", "CLASSROOM"], "CLASSROOM"],
    ["SCHOOL", true, ["CLASSROOM"], "CLASSROOM"],
    ["SELF", false, [], null],
  ] as const)("%s (teacher %s)", (level, teacher, levels, recipients) => {
    expect(allowedTargetLevels(level, teacher)).toEqual(levels);
    expect(recipientLevel(level)).toBe(recipients);
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
