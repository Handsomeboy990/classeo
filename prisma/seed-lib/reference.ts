// Reference data shared by the seed and the history seed: levels,
// subjects, coefficients, weekly hours and the name pools.

// Weekly hours of each secondary subject, roughly by coefficient.
export const SECONDARY_HOURS: Record<string, number> = { FR: 5, MATH: 5, ANG: 3, HG: 3, SVT: 3, PCT: 2, EPS: 2 };

export const LEVELS = [
  { code: "CI", name: "CI", cycle: "PRIMARY", order: 1 },
  { code: "CP", name: "CP", cycle: "PRIMARY", order: 2 },
  { code: "CE1", name: "CE1", cycle: "PRIMARY", order: 3 },
  { code: "CE2", name: "CE2", cycle: "PRIMARY", order: 4 },
  { code: "CM1", name: "CM1", cycle: "PRIMARY", order: 5 },
  { code: "CM2", name: "CM2", cycle: "PRIMARY", order: 6 },
  { code: "6E", name: "6e", cycle: "SECONDARY", order: 7 },
  { code: "5E", name: "5e", cycle: "SECONDARY", order: 8 },
  { code: "4E", name: "4e", cycle: "SECONDARY", order: 9 },
  { code: "3E", name: "3e", cycle: "SECONDARY", order: 10 },
  { code: "2NDE", name: "2nde", cycle: "SECONDARY", order: 11 },
  { code: "1ERE", name: "1ère", cycle: "SECONDARY", order: 12 },
  { code: "TLE", name: "Tle", cycle: "SECONDARY", order: 13 },
] as const;

export const SECONDARY_SUBJECTS = [
  { code: "FR", name: "Français", coef: 3 },
  { code: "MATH", name: "Mathématiques", coef: 3 },
  { code: "ANG", name: "Anglais", coef: 2 },
  { code: "HG", name: "Histoire-Géographie", coef: 2 },
  { code: "SVT", name: "Sciences de la vie et de la terre", coef: 2 },
  { code: "PCT", name: "Physique, chimie et technologie", coef: 2 },
  { code: "EPS", name: "Éducation physique et sportive", coef: 1 },
];
// Official coefficients (MESTFP order n° 029 of 2024, annex 2): every
// subject at 1 in 6e and 5e; the national grid in 4e and 3e (Mathématiques
// 3, PCT 2, SVT 2, Français 2 for reading and 2 for writing, Anglais 2,
// Histoire-Géographie 2, EPS 1); a grid per series in the second cycle. The
// seed has a single Français subject, given the reading coefficient. The
// second cycle values other than Mathématiques 6 and PCT 5 in série C come
// from common practice and are to be checked against the annex.
export const SERIES_COEFFICIENTS: Record<string, Record<string, number>> = {
  C: { FR: 2, MATH: 6, ANG: 2, HG: 2, SVT: 2, PCT: 5, EPS: 1 },
  D: { FR: 2, MATH: 4, ANG: 2, HG: 2, SVT: 5, PCT: 4, EPS: 1 },
};
export const FIRST_CYCLE_UPPER: Record<string, number> = { FR: 2, MATH: 3, ANG: 2, HG: 2, SVT: 2, PCT: 2, EPS: 1 };
export function coefficientOf(levelCode: string, stream: string, subject: { code: string; coef: number }) {
  if (levelCode === "6E" || levelCode === "5E") return 1;
  if (levelCode === "4E" || levelCode === "3E") return FIRST_CYCLE_UPPER[subject.code] ?? 1;
  if (levelCode === "2NDE" || levelCode === "1ERE" || levelCode === "TLE") return SERIES_COEFFICIENTS[stream]?.[subject.code] ?? 1;
  return subject.coef;
}

export const PRIMARY_SUBJECTS = [
  { code: "P-FR", name: "Français", coef: 3 },
  { code: "P-MATH", name: "Mathématiques", coef: 3 },
  { code: "P-EST", name: "Éducation scientifique et technologique", coef: 2 },
  { code: "P-ES", name: "Éducation sociale", coef: 2 },
  { code: "P-EA", name: "Éducation artistique", coef: 1 },
  { code: "P-EPS", name: "Éducation physique et sportive", coef: 1 },
];

export const FIRST_F = ["Afiavi", "Akouavi", "Sènami", "Ayaba", "Houéfa", "Nafissatou", "Rachidatou", "Chimène", "Grâce", "Mireille", "Pélagie", "Bénédicta", "Esther", "Fifamè", "Sèdami", "Aïcha", "Mariam", "Rosine", "Carine", "Estelle", "Laurelle", "Fadilatou", "Olga", "Prisca", "Ruth"];
export const FIRST_M = ["Koffi", "Codjo", "Comlan", "Mahougnon", "Arnaud", "Ulrich", "Romaric", "Fiacre", "Brice", "Ibrahim", "Moussa", "Soulé", "Saka", "Orou", "Sabi", "Yacoubou", "Kamarou", "Rodrigue", "Gildas", "Jonas", "Aristide", "Mathias", "Florentin", "Sèdjro", "Rachad"];
export const LAST = ["Adjovi", "Agossou", "Ahouandjinou", "Akpovi", "Amoussou", "Assogba", "Avocè", "Azonhiho", "Dossou", "Gbaguidi", "Hounkpatin", "Houngbédji", "Kiki", "Kpadonou", "Lokossou", "Sossou", "Tossou", "Houénou", "Agbodjogbé", "Adéoti", "Akanni", "Olatoundji", "Idrissou", "Adékambi", "Sanni", "Chabi", "Worou", "Gounou", "Bani", "Issifou", "Alassane", "Salifou", "Mama", "Yessoufou", "Dègbo", "Zannou", "Hounsa", "Tchibozo", "Ahouansou", "Kakpo"];
export const PROFESSIONS = ["Commerçante", "Agriculteur", "Enseignante", "Couturière", "Mécanicien", "Infirmière", "Conducteur de taxi-moto", "Fonctionnaire", "Artisan", "Pêcheur", "Revendeuse", "Menuisier"];

// Weekly hours of each primary subject.
export const PRIMARY_HOURS: Record<string, number> = { "P-FR": 7, "P-MATH": 6, "P-EST": 3, "P-ES": 3, "P-EA": 2, "P-EPS": 2 };
