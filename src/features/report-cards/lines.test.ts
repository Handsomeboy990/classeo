import { describe, expect, it } from "vitest";

import { fillLineTeachers, hasTeacherColumn } from "./lines";

describe("fillLineTeachers", () => {
  const current = new Map([
    ["Français", "Ayaba Worou"],
    ["Mathématiques", "Nafissatou Issifou"],
  ]);

  it("keeps the teacher recorded in the snapshot", () => {
    const lines = fillLineTeachers([{ subject: "Mathématiques", teacher: "Kamarou Ahouansou" }], current);
    expect(lines[0]!.teacher).toBe("Kamarou Ahouansou");
  });

  it("falls back on the teacher currently assigned in the class", () => {
    const lines = fillLineTeachers([{ subject: "Français" }, { subject: "Anglais", teacher: null }], current);
    expect(lines.map((l) => l.teacher)).toEqual(["Ayaba Worou", null]);
  });
});

describe("hasTeacherColumn", () => {
  it("hides the column when no row names a teacher", () => {
    expect(hasTeacherColumn([{ subject: "Français", teacher: null }, { subject: "Anglais" }])).toBe(false);
    expect(hasTeacherColumn([{ subject: "Français", teacher: "Ayaba Worou" }])).toBe(true);
  });
});
