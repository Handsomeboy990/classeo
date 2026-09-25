import { describe, expect, it } from "vitest";

import { nextFreeUsername, usernameBase } from "./username";

describe("usernameBase", () => {
  it("joins first and last name without accents, spaces or apostrophes", () => {
    expect(usernameBase("Sènami", "Hounkpatin")).toBe("senami.hounkpatin");
    expect(usernameBase("Jean Marie", "N'Dah")).toBe("jeanmarie.ndah");
    expect(usernameBase("Adékambi", "")).toBe("adekambi");
  });
});

describe("nextFreeUsername", () => {
  it("numbers from 2 when the name is taken", () => {
    expect(nextFreeUsername("a.b", [])).toBe("a.b");
    expect(nextFreeUsername("a.b", ["a.b"])).toBe("a.b2");
    expect(nextFreeUsername("a.b", ["a.b", "a.b2", "a.b3"])).toBe("a.b4");
  });
});
