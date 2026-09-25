// A participant's role as shown in the messaging, in the grammatical gender
// of the person when their account records it ("Enseignante" for a woman).
// Custom roles created by the ministry, and accounts without a recorded
// gender, keep the role name as written.

const FEMININE: Record<string, string> = {
  "Administrateur national": "Administratrice nationale",
  "Analyste national": "Analyste nationale",
  "Directeur départemental": "Directrice départementale",
  Enseignant: "Enseignante",
  "Parent ou tuteur": "Parent ou tutrice",
};

export function roleLabel(roleName: string, gender: "F" | "M" | null | undefined) {
  return gender === "F" ? (FEMININE[roleName] ?? roleName) : roleName;
}
