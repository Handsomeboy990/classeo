// Photographs of school life in Benin shown on the public pages, with their
// credits. The one source for the landing captions, the /credits page and
// public/images/CREDITS.md (written from this list by
// scripts/write-credits.ts, checked by photos.test.ts). No image import here:
// the scripts read this file too (see photo-images.ts for the files).
//
// The French texts (caption, subject, alt, changes) are shown translated on
// the public pages; the names of people, organisations and places are
// never translated.

export type Licence = { name: string; url: string | null };

export const LICENCES = {
  "CC BY 4.0": { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/deed.fr" },
  "CC BY-SA 4.0": { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/deed.fr" },
  // Work of a United States federal agency (Peace Corps): the source page
  // states the public domain status.
  "Public domain": { name: "Domaine public", url: null },
} as const satisfies Record<string, Licence>;

export type Photo = {
  file: string;
  // Short caption of the landing page, without names.
  caption: string;
  // A place or a school, shown after the caption and never translated.
  place?: string;
  // What the photograph shows, on the credits page.
  subject: string;
  alt: string;
  author: string;
  // Shorter form of the author for a caption under a photograph.
  credit: string;
  sourceUrl: string;
  licence: keyof typeof LICENCES;
  // What was changed from the original.
  changes: string;
};

const RESIZED = "Redimensionnée et convertie au format WebP.";

export const PHOTOS = [
  {
    file: "classe-lecture.webp",
    caption: "Leçon de lecture dans une école béninoise",
    subject: "Une leçon de lecture en 1997 : au tableau, « ada va à l'école » écrit à la craie.",
    alt: "Une classe de lecture au Bénin : au tableau, « ada va à l'école » écrit à la craie, des élèves assis sur des bancs de bois.",
    author: "Thomas Dorn, European Communities (EC Audiovisual Service)",
    credit: "Thomas Dorn, Commission européenne",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:School_in_Benin_-_1997.jpg",
    licence: "CC BY 4.0",
    changes: RESIZED,
  },
  {
    file: "cour-de-recreation.webp",
    caption: "Cour d'une école primaire publique",
    place: "EPP Savi, Godomey",
    subject: "La cour de l'école primaire publique de Savi, à Godomey.",
    alt: "Une cour d'école en sable, des élèves en uniforme kaki ; au premier plan, une petite fille avec son cartable salue.",
    author: "Rofik Adam",
    credit: "Rofik Adam",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Cour_de_Recreation_EPP_Savi.jpg",
    licence: "CC BY-SA 4.0",
    changes: "Redimensionnée et convertie au format WebP, le bas de l'image recadré.",
  },
  {
    file: "chemin-de-l-ecole.webp",
    caption: "Sur le chemin de l'école",
    subject: "Des élèves sur le chemin de l'école.",
    alt: "Trois élèves en uniforme marchent vers l'école avec une femme, dans une rue de ville.",
    author: "DEGAN Gabin",
    credit: "DEGAN Gabin",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:DEGAN_Gabin_-(_school_children_on_their_way_to_school_).jpg",
    licence: "CC BY-SA 4.0",
    changes: "Redimensionnée et convertie au format WebP, le haut de l'image recadré.",
  },
  {
    file: "lecture-a-plusieurs.webp",
    caption: "Lire à plusieurs",
    place: "Grand-Popo",
    subject: "Des élèves lisent ensemble, à Grand-Popo.",
    alt: "Des élèves allongés sur un carrelage lisent ensemble des livres illustrés.",
    author: "Kulttuurinavigaattori",
    credit: "Kulttuurinavigaattori",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Studying_books.jpg",
    licence: "CC BY-SA 4.0",
    changes: RESIZED,
  },
  {
    file: "sourires-en-classe.webp",
    caption: "Élèves à la porte de la classe",
    subject: "Des élèves à la porte de leur classe.",
    alt: "Des élèves en uniforme kaki sourient à la porte d'une salle de classe.",
    author: "Peace Corps",
    credit: "Peace Corps",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:BEN_2001-007-S20.jpg",
    licence: "Public domain",
    changes: RESIZED,
  },
] as const satisfies readonly Photo[];

export type PhotoFile = (typeof PHOTOS)[number]["file"];

export function photo(file: PhotoFile): Photo & { file: PhotoFile } {
  return PHOTOS.find((p) => p.file === file)!;
}

// "Thomas Dorn, Commission européenne, CC BY 4.0": the line under a
// photograph. The licence name stays as written by its author.
export function shortCredit(p: Photo) {
  return `${p.credit}, ${LICENCES[p.licence].name}`;
}

// Other works used by the platform that call for a credit: the French
// reading voice (Piper, self-hosted, trained on the SIWIS database).
export type OtherCredit = {
  id: string;
  kind: "voice";
  subject: string;
  author: string;
  sourceUrl: string;
  licence: keyof typeof LICENCES;
  changes: string;
};

export const OTHER_CREDITS = [
  {
    id: "voix-siwis",
    kind: "voice",
    subject: "La voix française qui lit les pages à voix haute.",
    author: "Piper (Rhasspy), voix siwis entraînée sur la base SIWIS de Pierre-Edouard Honnet, Alexandros Lazaridis, Philip N. Garner et Junichi Yamagishi",
    sourceUrl: "https://huggingface.co/rhasspy/piper-voices/tree/main/fr/fr_FR/siwis",
    licence: "CC BY 4.0",
    changes: "Aucune : la voix est utilisée telle quelle, sur le serveur de Classéo.",
  },
] as const satisfies readonly OtherCredit[];

// The translation and the voices in the local languages come from the
// api229langues service. A service used by the platform, not a work
// copied into it: no licence line, a thank you and its address.
export type LanguageCredit = { id: string; subject: string; author: string; sourceUrl: string };

export const LANGUAGE_CREDITS = [
  {
    id: "api229langues",
    subject: "La traduction des pages en fongbe et en yoruba, et les voix en fongbe, yoruba et haoussa.",
    author: "Finanfa Ronaldo (api229langues)",
    sourceUrl: "https://api229langues.vercel.app",
  },
] as const satisfies readonly LanguageCredit[];

// The French texts of the credits shown on the public pages, for the
// translation list.
export function photoTexts(): string[] {
  return [...PHOTOS.flatMap((p) => [p.caption, p.subject, p.alt, p.changes]), ...OTHER_CREDITS.flatMap((c) => [c.subject, c.changes]), ...LANGUAGE_CREDITS.map((c) => c.subject)];
}

// public/images/CREDITS.md, written from the list above.
export function creditsMarkdown() {
  const rows = PHOTOS.map((p) => `| \`${p.file}\` | ${p.subject} | ${p.author} | ${p.sourceUrl} | ${p.licence} | ${p.changes} |`);
  return [
    "# Credits",
    "",
    "Photographs of school life in Benin, from Wikimedia Commons, shown on the",
    "public pages and credited at /credits. Each file here is a resized WebP",
    "copy (cropped where noted) of the original; the licence of the original",
    "applies to the copy. The copies under CC BY-SA are shared under the same",
    "licence.",
    "",
    "Generated from src/features/public-pages/photos.ts by",
    "`npx tsx scripts/write-credits.ts`: edit the list there, not this file.",
    "",
    "| File | Subject | Author | Source | Licence | Changes |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Voices",
    "",
    "| Voice | Use | Author | Source | Licence | Changes |",
    "|---|---|---|---|---|---|",
    ...OTHER_CREDITS.map((c) => `| \`${c.id}\` | ${c.subject} | ${c.author} | ${c.sourceUrl} | ${c.licence} | ${c.changes} |`),
    "",
    "## Local languages",
    "",
    "| Service | Use | Author | Source |",
    "|---|---|---|---|",
    ...LANGUAGE_CREDITS.map((c) => `| \`${c.id}\` | ${c.subject} | ${c.author} | ${c.sourceUrl} |`),
    "",
    "Licences: CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ and",
    "CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/.",
    "",
  ].join("\n");
}
