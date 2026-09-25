import { createHash } from "node:crypto";

import { normalise } from "./text";

// Key of a cached translation or speech clip: sha256 of the normalised
// source text. Stored in Translation.key (unique with the language) and in
// the name of a cached audio file.
export function cacheKey(text: string) {
  return createHash("sha256").update(normalise(text), "utf8").digest("hex");
}
