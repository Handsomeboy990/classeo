import type { StaticImageData } from "next/image";

import chemin from "../../../public/images/chemin-de-l-ecole.webp";
import classe from "../../../public/images/classe-lecture.webp";
import cour from "../../../public/images/cour-de-recreation.webp";
import lecture from "../../../public/images/lecture-a-plusieurs.webp";
import sourires from "../../../public/images/sourires-en-classe.webp";

import type { PhotoFile } from "./photos";

// Static imports of the photographs: width, height and the blur placeholder
// come with them. Kept apart from photos.ts, which the scripts read.
export const PHOTO_IMAGES: Record<PhotoFile, StaticImageData> = {
  "classe-lecture.webp": classe,
  "cour-de-recreation.webp": cour,
  "chemin-de-l-ecole.webp": chemin,
  "lecture-a-plusieurs.webp": lecture,
  "sourires-en-classe.webp": sourires,
};
