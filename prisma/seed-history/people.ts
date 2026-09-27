import { FIRST_F, FIRST_M, LAST, PROFESSIONS } from "../seed-lib/reference";
import type { Rng } from "../seed-lib/random";

// People drawn with the history generator, from the same name pools as the
// rest of the seed.
export function people(rng: Rng) {
  const person = (gender?: "F" | "M", girls = 0.49) => {
    const g: "F" | "M" = gender ?? (rng.chance(girls) ? "F" : "M");
    return { gender: g, firstName: rng.pick(g === "F" ? FIRST_F : FIRST_M), lastName: rng.pick(LAST) };
  };
  const phone = () => `01${rng.pick(["90", "91", "94", "95", "96", "97", "61", "62", "66", "67"])}${String(rng.int(0, 999999)).padStart(6, "0")}`;
  const profession = () => rng.pick(PROFESSIONS);
  return { person, phone, profession };
}

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
