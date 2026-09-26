// How a message to several people is delivered. Pure, unit tested.
//
// - "shared": one conversation where everyone reads everyone, for staff
//   writing to staff (a head of school and the teachers of a class).
// - "separate": one private conversation per recipient, like the
//   institution broadcast. Always the case as soon as a family takes part,
//   on either side: a teacher writing to the parents of a class must never
//   show one parent the name, the phone or the answer of another, and a
//   parent writing to several teachers talks to each one privately.

export const MAX_RECIPIENTS = 60;
export const MAX_SHARED = 25;

export type Plan = "single" | "shared" | "separate";

export function deliveryPlan(input: { senderIsFamily: boolean; recipientsAreFamily: boolean[]; wantShared: boolean }): Plan {
  const n = input.recipientsAreFamily.length;
  if (n <= 1) return "single";
  return canShare(input.senderIsFamily, input.recipientsAreFamily) && input.wantShared ? "shared" : "separate";
}

// Whether a shared conversation may be offered for this choice.
export function canShare(senderIsFamily: boolean, recipientsAreFamily: boolean[]) {
  return !senderIsFamily && recipientsAreFamily.length > 1 && recipientsAreFamily.length <= MAX_SHARED && recipientsAreFamily.every((f) => !f);
}

// Picked ids, deduplicated, each one checked against the contacts the
// server computed for this user. Any id outside them refuses the whole send:
// nothing is written for a forged or stale list.
export function resolveRecipients<C extends { id: string }>(picked: string[], contacts: C[]): C[] | null {
  const unique = [...new Set(picked)];
  if (!unique.length || unique.length > MAX_RECIPIENTS) return null;
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const found = unique.map((id) => byId.get(id));
  return found.every((c) => c !== undefined) ? (found as C[]) : null;
}
