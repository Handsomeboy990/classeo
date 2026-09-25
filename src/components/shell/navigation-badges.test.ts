import { describe, expect, it } from "vitest";

import { badgeText, navigationBadges, type NavSection } from "@/lib/navigation";

const icon = (() => null) as unknown as NavSection["items"][number]["icon"];
const sections: NavSection[] = [
  { title: "Général", items: [{ label: "Tableau de bord", href: "/espace", icon }, { label: "Mes enfants", href: "/espace/suivi", icon }] },
  {
    title: "Communication",
    items: [
      { label: "Messagerie", href: "/espace/messages", icon },
      { label: "Notifications", href: "/espace/notifications", icon },
    ],
  },
];

describe("navigationBadges", () => {
  it("counts each unread notification on the entry its link falls under", () => {
    const counts = navigationBadges(sections, ["/espace/messages/abc", "/espace/messages", "/espace/suivi/s1/presences?x=1", null, "/espace/bulletins/1"]);
    expect(counts["/espace/messages"]).toBe(2);
    expect(counts["/espace/suivi"]).toBe(1);
    // The total on Notifications, links without an entry included.
    expect(counts["/espace/notifications"]).toBe(5);
    // Never on the dashboard.
    expect(counts["/espace"]).toBeUndefined();
  });

  it("returns nothing when all is read", () => {
    expect(navigationBadges(sections, [])).toEqual({});
  });

  it("keeps a badge short", () => {
    expect(badgeText(3)).toBe("3");
    expect(badgeText(12)).toBe("9+");
  });
});
