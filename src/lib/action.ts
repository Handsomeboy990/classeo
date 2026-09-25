import "server-only";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { authorize, ForbiddenError } from "@/lib/auth/authorize";
import type { PermissionCode } from "@/lib/auth/permissions";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  data?: unknown;
} | null;

type Handler<T> = (input: T, user: NonNullable<CurrentUser>) => Promise<string | { message: string; data?: unknown } | void>;

// Converts FormData to a plain object. Keys ending in [] and repeated keys
// become arrays.
export function formToObject(formData: FormData) {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of formData.entries()) {
    if (rawKey.startsWith("$ACTION")) continue;
    const isArray = rawKey.endsWith("[]");
    const key = isArray ? rawKey.slice(0, -2) : rawKey;
    if (isArray || key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : prev === undefined ? [value] : [prev, value];
    } else out[key] = value;
  }
  return out;
}

// Every server action goes through this: authenticate, authorize, validate,
// run, and turn failures into a message the form can display. The handler is
// responsible for scoping its queries (lib/auth/scope.ts), auditing and
// invalidating caches.
export function createAction<S extends z.ZodType>(options: {
  // null: any signed in user, for actions on their own records (their
  // notifications, their preferences). The handler must then scope by user id.
  permission: PermissionCode | null;
  schema: S;
  handler: Handler<z.infer<S>>;
}) {
  return async function action(_prev: ActionState, input: FormData | z.input<S>): Promise<ActionState> {
    try {
      const user = await getCurrentUser();
      if (options.permission === null) {
        if (!user) throw new ForbiddenError("Session expirée. Veuillez vous reconnecter.");
      } else authorize(user, options.permission);

      const raw = input instanceof FormData ? formToObject(input) : input;
      const parsed = options.schema.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          message: "Certains champs sont invalides.",
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        };
      }

      const result = await options.handler(parsed.data, user);
      if (typeof result === "string") return { ok: true, message: result };
      if (result) return { ok: true, message: result.message, data: result.data };
      return { ok: true };
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof ForbiddenError || error instanceof DomainError) return { ok: false, message: error.message };
      console.error("action failed", error);
      return { ok: false, message: "Une erreur inattendue est survenue. Réessayez dans un instant." };
    }
  };
}
