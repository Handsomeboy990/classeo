import "server-only";

import { z } from "zod";

import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/files";

// A student photo is never required: an empty file field means "no change".
export const optionalPhoto = z
  .custom<File>((v) => v === undefined || v === null || v === "" || (typeof File !== "undefined" && v instanceof File), "Fichier invalide.")
  .optional()
  .transform((v) => (v instanceof File && v.size > 0 ? v : undefined));

// Stores the photo (size and real format checked by saveUpload) and returns
// its id. Called before any other write, so a refused file changes nothing.
export async function storeStudentPhoto(user: NonNullable<CurrentUser>, file: File | undefined) {
  if (!file) return null;
  return saveUpload(user, "student_photo", file);
}

// The previous photo is removed once replaced, unless something else still
// points to it.
export async function dropPhotoBlob(fileId: string | null | undefined) {
  if (!fileId) return;
  const used = await db.student.count({ where: { photoFileId: fileId } });
  if (!used) await db.fileBlob.deleteMany({ where: { id: fileId, purpose: "student_photo" } });
}
