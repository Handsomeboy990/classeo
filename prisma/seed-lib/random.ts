import { randomBytes } from "node:crypto";

// Seeded randomness for the seed: the same seed always gives the same draws.
// Each part of the seed that must not move the draws of another keeps its
// own generator.

export type Rng = ReturnType<typeof createRng>;

export function createRng(seed: number) {
  let state = seed;
  const rand = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const normal = (mean: number, sd: number) => {
    const u = 1 - rand();
    const v = rand();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const chance = (p: number) => rand() < p;
  const shuffle = <T,>(list: readonly T[]) =>
    list
      .map((x) => ({ x, r: rand() }))
      .sort((a, b) => a.r - b.r)
      .map((o) => o.x);
  return { rand, int, pick, normal, chance, shuffle };
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// A random identifier shaped like Prisma's cuid (25 characters): shorter
// than a UUID, which counts on the hundreds of thousands of rows of the
// past years (every id is also in one or more indexes).
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
export function shortId() {
  const bytes = randomBytes(24);
  let s = "c";
  for (const b of bytes) s += ALPHABET[b % 36];
  return s;
}
