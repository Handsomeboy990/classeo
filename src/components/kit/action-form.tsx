"use client";

import { useRouter } from "next/navigation";
import { createContext, useActionState, useContext, useEffect, useEffectEvent, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action";

import { toast } from "./toaster";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>(null);
export const useFormState = () => useContext(FormStateContext);

// Wraps any server action created with createAction(): pending state, field
// errors passed down to FormField, toast on result, optional reset and
// callback on success.
export function ActionForm({
  action,
  children,
  onSuccess,
  resetOnSuccess = false,
  successToast = true,
  className,
  ...props
}: {
  action: ServerAction;
  children: ReactNode;
  onSuccess?: (state: ActionState) => void;
  resetOnSuccess?: boolean;
  successToast?: boolean;
  className?: string;
} & Omit<ComponentProps<"form">, "action" | "onSubmit">) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const handleResult = useEffectEvent((result: NonNullable<ActionState>) => {
    if (result.ok) {
      if (successToast && result.message) toast("success", result.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(result);
      router.refresh();
    } else if (result.message) {
      toast("error", result.message);
    }
  });

  useEffect(() => {
    if (state) handleResult(state);
  }, [state]);

  return (
    <FormStateContext.Provider value={state}>
      <form ref={formRef} action={formAction} className={className} noValidate {...props}>
        {children}
      </form>
    </FormStateContext.Provider>
  );
}

export function SubmitButton({ children, pendingLabel, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending ? (pendingLabel ?? "Enregistrement…") : children}
    </Button>
  );
}
