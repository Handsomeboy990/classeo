import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import type { Bulk } from "../seed-lib/bulk";

export type PeriodRef = { id: string; name: string; periodicity: "TRIMESTER" | "SEMESTER"; order: number; startDate: Date; endDate: Date };
export type YearRef = { id: string; label: string; startDate: Date; endDate: Date };

export type SchoolRef = {
  id: string;
  code: string;
  name: string;
  cycle: "PRIMARY" | "SECONDARY";
  communeId: string;
  communeName: string;
  departmentName: string;
  departmentId: string;
  detailed: boolean;
  urban: boolean;
  quality: number;
  classSpecs: string[];
  sector: "PUBLIC" | "PRIVATE" | "CONFESSIONAL" | "COMMUNITY";
  periodicity: "TRIMESTER" | "SEMESTER";
};

export type LevelRef = { id: string; code: string; name: string; order: number; cycle: string };

export type HistoryInput = {
  db: PrismaClient;
  bulk: Bulk;
  passwordHash: string;
  roleIds: Record<string, string>;
  takenUsernames: Set<string>;
  year: YearRef;
  prevYear: YearRef;
  periods: { current: PeriodRef[]; prev: PeriodRef[] };
  levels: Map<string, LevelRef>;
  subjects: Map<string, string>;
  schools: SchoolRef[];
  teachers: Prisma.TeacherCreateManyInput[];
  teacherOfBySchool: Map<string, Map<string, string>>;
  teacherUserIds: Map<string, string>;
  classrooms: Prisma.ClassroomCreateManyInput[];
  assignments: (Prisma.CourseAssignmentCreateManyInput & { schoolId: string; subjectCode: string })[];
  students: Prisma.StudentCreateManyInput[];
  enrollments: Prisma.EnrollmentCreateManyInput[];
  studentMeta: Map<string, { ability: number; schoolId: string; classroomId: string; enrollmentId: string }>;
  users: {
    minister: string;
    director: string;
    accountant: string;
    parent: string;
    student: string;
    teacher: string;
    ddemp: Record<string, string>;
    ddestfp: Record<string, string>;
    heads: Map<string, string>;
  };
  demo: { senami: string; mahougnon: string; guardian: string };
  ceg: string;
  epp: string;
  currentDays: Date[];
};

// A year of the history: 0 is 2022-2023, 4 the active year 2026-2027.
export type HYear = YearRef & { index: number; startYear: number; periods: PeriodRef[]; closedAt: Date | null };

export type Outcome = "PROMOTED" | "REPEAT" | "EXCLUDED";

// One pupil in one class for one year.
export type Stint = {
  id: string;
  studentId: string;
  schoolId: string;
  year: number;
  spec: string;
  level: string;
  classroomId: string;
  isRepeating: boolean;
  status: "ACTIVE" | "TRANSFERRED" | "WITHDRAWN";
  // Periods of the school's periodicity completed before leaving, for a
  // pupil who left during the year.
  periodsDone: number | null;
  outcome: Outcome | null;
  fate: "STAYED" | "MOVED" | "DROPPED" | "WITHDRAWN" | "TRANSFERRED" | "EXCLUDED" | "COMPLETED" | "FAILED";
};

export type StudentInfo = { gender: "F" | "M"; ability: number; firstName: string; lastName: string; birthDate: Date; past: boolean };
