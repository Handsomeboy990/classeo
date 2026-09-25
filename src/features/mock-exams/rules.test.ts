import { describe, expect, it } from "vitest";

import { approvalLevel, canDecideAt, canRespond, canSubmit, computeResults, datesError, isExamLevel, isOrganizer, organizerLevelOf, resultsOpen } from "./rules";

const A1 = { communeId: "calavi", departmentId: "atlantique" };
const A2 = { communeId: "allada", departmentId: "atlantique" };
const L1 = { communeId: "cotonou", departmentId: "littoral" };

describe("exam levels and organiser", () => {
  it("only accepts the classes ending with a national examination", () => {
    expect(["CM2", "3E", "TLE"].every(isExamLevel)).toBe(true);
    expect(isExamLevel("4E")).toBe(false);
    expect(isExamLevel("CM1")).toBe(false);
  });

  it("derives the organiser level from the scope", () => {
    expect(organizerLevelOf("SCHOOL")).toBe("SCHOOL");
    expect(organizerLevelOf("COMMUNE")).toBe("COMMUNE");
    expect(organizerLevelOf("NATIONAL")).toBe("NATIONAL");
    expect(organizerLevelOf("SELF")).toBeNull();
  });
});

describe("isOrganizer", () => {
  const schoolExam = { organizerLevel: "SCHOOL" as const, organizerSchoolId: "ceg", organizerCommuneId: "calavi", organizerDepartmentId: "atlantique" };
  const communeExam = { organizerLevel: "COMMUNE" as const, organizerSchoolId: null, organizerCommuneId: "calavi", organizerDepartmentId: "atlantique" };
  it("recognises the organising school only", () => {
    expect(isOrganizer({ level: "SCHOOL", schoolId: "ceg", communeId: "calavi", departmentId: "atlantique" }, schoolExam)).toBe(true);
    expect(isOrganizer({ level: "SCHOOL", schoolId: "epp", communeId: "calavi", departmentId: "atlantique" }, schoolExam)).toBe(false);
    expect(isOrganizer({ level: "COMMUNE", schoolId: null, communeId: "calavi", departmentId: "atlantique" }, schoolExam)).toBe(false);
  });
  it("recognises the organising service at its own level", () => {
    expect(isOrganizer({ level: "COMMUNE", schoolId: null, communeId: "calavi", departmentId: "atlantique" }, communeExam)).toBe(true);
    expect(isOrganizer({ level: "COMMUNE", schoolId: null, communeId: "allada", departmentId: "atlantique" }, communeExam)).toBe(false);
    expect(isOrganizer({ level: "DEPARTMENT", schoolId: null, communeId: null, departmentId: "atlantique" }, communeExam)).toBe(false);
  });
});

describe("approvalLevel", () => {
  it("goes to the commune district when every school is in one commune", () => {
    expect(approvalLevel([A1, A1])).toBe("COMMUNE");
  });
  it("goes to the department across communes of one department", () => {
    expect(approvalLevel([A1, A2])).toBe("DEPARTMENT");
  });
  it("goes to the ministry across departments", () => {
    expect(approvalLevel([A1, L1])).toBe("NATIONAL");
  });
});

describe("canDecideAt", () => {
  const commune = { level: "COMMUNE" as const, communeId: "calavi", departmentId: "atlantique" };
  const department = { level: "DEPARTMENT" as const, communeId: null, departmentId: "atlantique" };
  const nation = { level: "NATIONAL" as const, communeId: null, departmentId: null };
  const school = { level: "SCHOOL" as const, communeId: "calavi", departmentId: "atlantique" };

  it("lets the district decide inside its commune", () => {
    expect(canDecideAt(commune, "COMMUNE", [A1, A1])).toBe(true);
  });
  it("refuses a district for another commune or a higher level", () => {
    expect(canDecideAt(commune, "COMMUNE", [A2])).toBe(false);
    expect(canDecideAt(commune, "DEPARTMENT", [A1, A2])).toBe(false);
  });
  it("lets a higher level covering every school decide", () => {
    expect(canDecideAt(department, "COMMUNE", [A1])).toBe(true);
    expect(canDecideAt(department, "DEPARTMENT", [A1, A2])).toBe(true);
    expect(canDecideAt(department, "NATIONAL", [A1, L1])).toBe(false);
    expect(canDecideAt(nation, "NATIONAL", [A1, L1])).toBe(true);
  });
  it("never lets a school decide", () => {
    expect(canDecideAt(school, "COMMUNE", [A1])).toBe(false);
  });
});

describe("workflow", () => {
  const start = new Date("2026-11-10T00:00:00Z");
  const before = new Date("2026-11-01T10:00:00Z");
  const sameDay = new Date("2026-11-10T15:00:00Z");

  it("lets an invited school answer once, before the start", () => {
    expect(canRespond({ status: "DRAFT", startDate: start }, "INVITED", before)).toBe(true);
    expect(canRespond({ status: "PENDING_APPROVAL", startDate: start }, "INVITED", before)).toBe(true);
    expect(canRespond({ status: "DRAFT", startDate: start }, "ACCEPTED", before)).toBe(false);
    expect(canRespond({ status: "DRAFT", startDate: start }, "INVITED", sameDay)).toBe(false);
    expect(canRespond({ status: "REJECTED", startDate: start }, "INVITED", before)).toBe(false);
  });

  it("never lets an imposed participation be answered", () => {
    expect(canRespond({ status: "APPROVED", startDate: start }, "IMPOSED", before)).toBe(false);
  });

  it("submits a school exam once a partner accepted", () => {
    const exam = { status: "DRAFT" as const, organizerLevel: "SCHOOL" as const };
    expect(canSubmit(exam, [{ status: "ACCEPTED", isOrganizer: true }, { status: "INVITED", isOrganizer: false }])).toBe(false);
    expect(canSubmit(exam, [{ status: "ACCEPTED", isOrganizer: true }, { status: "ACCEPTED", isOrganizer: false }])).toBe(true);
    expect(canSubmit({ ...exam, status: "REJECTED" }, [{ status: "ACCEPTED", isOrganizer: false }])).toBe(true);
    expect(canSubmit({ ...exam, status: "PENDING_APPROVAL" }, [{ status: "ACCEPTED", isOrganizer: false }])).toBe(false);
    expect(canSubmit({ ...exam, organizerLevel: "COMMUNE" }, [{ status: "IMPOSED", isOrganizer: false }])).toBe(false);
  });

  it("opens results only for an approved exam that has started", () => {
    expect(resultsOpen({ status: "APPROVED", startDate: start }, sameDay)).toBe(true);
    expect(resultsOpen({ status: "APPROVED", startDate: start }, before)).toBe(false);
    expect(resultsOpen({ status: "PENDING_APPROVAL", startDate: start }, sameDay)).toBe(false);
    expect(resultsOpen({ status: "CLOSED", startDate: start }, sameDay)).toBe(false);
  });

  it("checks the dates", () => {
    const year = { startDate: new Date("2026-09-14"), endDate: new Date("2027-07-02") };
    expect(datesError(new Date("2026-11-10"), new Date("2026-11-12"), year)).toBeNull();
    expect(datesError(new Date("2026-11-12"), new Date("2026-11-10"), year)).toMatch(/fin/);
    expect(datesError(new Date("2027-08-01"), new Date("2027-08-02"), year)).toMatch(/année scolaire/);
    expect(datesError(new Date("2026-11-01"), new Date("2026-11-30"), year)).toMatch(/deux semaines/);
  });
});

describe("computeResults", () => {
  const candidates = [
    { enrollmentId: "a", schoolId: "s1" },
    { enrollmentId: "b", schoolId: "s1" },
    { enrollmentId: "c", schoolId: "s2" },
    { enrollmentId: "d", schoolId: "s2" },
  ];
  const scores = [
    { enrollmentId: "a", subjectCode: "FR", score: 14 },
    { enrollmentId: "a", subjectCode: "MATH", score: 16 },
    { enrollmentId: "b", subjectCode: "FR", score: 8 },
    { enrollmentId: "b", subjectCode: "MATH", score: 9 },
    { enrollmentId: "c", subjectCode: "FR", score: 15 },
    { enrollmentId: "c", subjectCode: "MATH", score: 15 },
    // d misses mathematics, and a score for a subject outside the exam is ignored.
    { enrollmentId: "d", subjectCode: "FR", score: 19 },
    { enrollmentId: "d", subjectCode: "SVT", score: 20 },
  ];
  const r = computeResults(candidates, ["FR", "MATH"], scores);
  const by = Object.fromEntries(r.results.map((x) => [x.enrollmentId, x]));

  it("averages the subjects entered with equal weights", () => {
    expect(by.a!.average).toBe(15);
    expect(by.b!.average).toBe(8.5);
    expect(by.d!.average).toBe(19);
    expect(by.d!.scores.SVT).toBeUndefined();
  });

  it("ranks complete candidates only, with ties, per school and overall", () => {
    expect(by.a!.overallRank).toBe(1);
    expect(by.a!.overallTied).toBe(true);
    expect(by.c!.overallRank).toBe(1);
    expect(by.b!.overallRank).toBe(3);
    expect(by.d!.overallRank).toBeNull();
    expect(by.d!.complete).toBe(false);
    expect(by.b!.schoolRank).toBe(2);
    expect(by.c!.schoolRank).toBe(1);
  });

  it("summarises each school and ranks the schools", () => {
    const [first, second] = r.schools;
    expect(first!.schoolId).toBe("s2");
    expect(first!.average).toBe(17);
    expect(first!.rank).toBe(1);
    expect(second!.schoolId).toBe("s1");
    expect(second!.average).toBe(11.75);
    expect(second!.passRate).toBe(0.5);
    expect(second!.subjectAverages.MATH).toBe(12.5);
  });

  it("averages each subject across schools", () => {
    expect(r.subjectAverages.FR).toBe(14);
    expect(r.subjectAverages.MATH).toBe(13.33);
    expect(r.overall.candidates).toBe(4);
    expect(r.overall.complete).toBe(3);
  });

  it("handles an exam without any score", () => {
    const empty = computeResults(candidates, ["FR"], []);
    expect(empty.overall.average).toBeNull();
    expect(empty.schools.every((s) => s.rank === null)).toBe(true);
  });
});
