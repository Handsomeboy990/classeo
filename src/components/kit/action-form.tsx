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

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action";

import { useText } from "./text-provider";
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
  errorToast = true,
  className,
  ...props
}: {
  action: ServerAction;
  children: ReactNode;
  onSuccess?: (state: ActionState) => void;
  resetOnSuccess?: boolean;
  successToast?: boolean;
  // false: the form shows the refusal itself (see FormMessage).
  errorToast?: boolean;
  className?: string;
} & Omit<ComponentProps<"form">, "action" | "onSubmit">) {
  const { t } = useText();
  // Toasts fire as soon as the server answers, inside the dispatch: when the
  // action revalidates, the refreshed tree can unmount this form before any
  // effect runs, and the message would be lost.
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.ok && successToast && result.message) toast("success", t(result.message));
    if (result && !result.ok && errorToast && result.message) toast("error", t(result.message));
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

// The refusal of the server shown inside the form, for a form that turns
// the error toast off: announced at once by screen readers and kept in view
// while the person corrects. Hidden during the next attempt, so a second
// refusal is announced again.
export function FormMessage({ title, className }: { title?: string; className?: string }) {
  const state = useContext(FormStateContext);
  const pending = useContext(PendingContext);
  const { t } = useText();
  if (!state || state.ok || !state.message || pending) return null;
  return (
    <Alert tone="danger" title={title} className={className}>
      {t(state.message)}
    </Alert>
  );
}
