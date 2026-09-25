export const SECTORS = ["PUBLIC", "PRIVATE", "CONFESSIONAL", "COMMUNITY"] as const;
export const CYCLES = ["PRESCHOOL", "PRIMARY", "SECONDARY", "TECHNICAL"] as const;

export type Sector = (typeof SECTORS)[number];
export type Cycle = (typeof CYCLES)[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  PUBLIC: "Public",
  PRIVATE: "Privé laïc",
  CONFESSIONAL: "Confessionnel",
  COMMUNITY: "Communautaire",
};

export const CYCLE_LABELS: Record<Cycle, string> = {
  PRESCHOOL: "Maternelle",
  PRIMARY: "Primaire",
  SECONDARY: "Secondaire général",
  TECHNICAL: "Technique et professionnel",
};

export const isSector = (v: unknown): v is Sector => typeof v === "string" && (SECTORS as readonly string[]).includes(v);
export const isCycle = (v: unknown): v is Cycle => typeof v === "string" && (CYCLES as readonly string[]).includes(v);
