"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action";

import { toast } from "./toaster";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>(null);
export const useFormState = () => useContext(FormStateContext);
const PendingContext = createContext(false);

// Wraps any server action created with createAction(): pending state, field
// errors passed down to FormField, toast on result, optional reset and
// callback on success.
// Submission goes through onSubmit rather than the form action attribute:
// React resets a form after its action settles, which would wipe what the
// user typed when the server refuses it. Here the values stay, and focus
// moves to the first invalid field.
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
  // Toasts fire as soon as the server answers, inside the dispatch: when the
  // action revalidates, the refreshed tree can unmount this form before any
  // effect runs, and the message would be lost.
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.ok && successToast && result.message) toast("success", result.message);
    if (result && !result.ok && result.message) toast("error", result.message);
    return result;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const handleResult = useEffectEvent((result: NonNullable<ActionState>) => {
    if (result.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(result);
      router.refresh();
    } else {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    }
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  useEffect(() => {
    if (state) handleResult(state);
  }, [state]);

  return (
    <FormStateContext.Provider value={state}>
      <PendingContext.Provider value={pending}>
        <form ref={formRef} onSubmit={handleSubmit} className={className} noValidate aria-busy={pending || undefined} {...props}>
          {children}
        </form>
      </PendingContext.Provider>
    </FormStateContext.Provider>
  );
}

export function SubmitButton({ children, pendingLabel, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const pending = useContext(PendingContext);
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending ? (pendingLabel ?? "Enregistrement…") : children}
    </Button>
  );
}
