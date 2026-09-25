import { toast } from "@/components/kit/toaster";
import type { ActionState } from "@/lib/action";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// For actions that invalidate cached statistics: the refreshed page can
// unmount the form (a settled invoice loses its payment form, a cancelled
// payment its row) before ActionForm announces the result. The success toast
// is therefore raised here, as soon as the action resolves, and the message
// is removed from the state so ActionForm does not announce it twice.
export function announceSuccess(action: ServerAction, then?: (state: NonNullable<ActionState>) => void): ServerAction {
  return async (prev, formData) => {
    const result = await action(prev, formData);
    if (result?.ok) {
      if (result.message) toast("success", result.message);
      then?.(result);
      return { ...result, message: undefined };
    }
    return result;
  };
}
