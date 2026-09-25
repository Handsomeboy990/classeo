// Writes public/images/CREDITS.md from the list of photographs in
// src/features/public-pages/photos.ts, the one place where credits are
// edited. photos.test.ts fails when the file is out of date.
//
// Usage: npx tsx scripts/write-credits.ts

import { writeFileSync } from "node:fs";
import path from "node:path";

import { creditsMarkdown } from "../src/features/public-pages/photos";

const file = path.resolve(__dirname, "../public/images/CREDITS.md");
writeFileSync(file, creditsMarkdown());
console.log(`Written ${path.relative(process.cwd(), file)}`);
