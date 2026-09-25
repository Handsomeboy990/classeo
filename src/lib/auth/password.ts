import { hash, verify } from "@node-rs/argon2";

// OWASP recommended argon2id parameters (19 MiB, 2 iterations).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Verified against when the email is unknown, so a missing account takes as
// long to reject as a wrong password and cannot be told apart by timing.
let dummyHash: Promise<string> | undefined;
export function dummyVerify(password: string) {
  dummyHash ??= hashPassword("classeo-dummy-password-never-valid");
  return dummyHash.then((h) => verifyPassword(h, password)).then(() => false);
}
