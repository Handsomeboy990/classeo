"use client";

import { Building2, MessageSquarePlus, SendHorizonal, UserRound } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { MultiPicker, type PickerOption } from "@/components/kit/multi-picker";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Switch, Textarea } from "@/components/ui/input";
import { MAX_INSTITUTION_RECIPIENTS } from "@/lib/domain/institutions";
import { cn } from "@/lib/utils";

import { FormRecovery } from "../contents/form-recovery";
import { startConversation } from "./actions";
import type { Contact } from "./queries";
import { canShare, MAX_RECIPIENTS } from "./recipients";
import { QUICK_MESSAGES } from "./templates";

type Mode = "person" | "institution";

// Two ways to start a conversation: with a person, or, for the staff of an
// institution, on behalf of that institution with one or several others
// (one conversation each). Both pickers only offer what the server accepts.
export function NewConversation({
  contacts,
  institutions,
  sender,
  showQuick,
  family = false,
}: {
  contacts: Contact[];
  institutions: PickerOption[];
  // Name of the institution the user writes for, if any.
  sender: string | null;
  showQuick: boolean;
  // The user is a parent or a student: every group send is private.
  family?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const canInstitution = !!sender && institutions.length > 0;
  const [mode, setMode] = useState<Mode>(contacts.length === 0 && canInstitution ? "institution" : "person");
  const [person, setPerson] = useState<string[]>([]);
  const [shared, setShared] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const familyOf = new Map(contacts.map((c) => [c.id, c.family]));
  const shareable = canShare(family, person.map((id) => familyOf.get(id) ?? true));
  const separate = person.length > 1 && !(shareable && shared);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const people: PickerOption[] = contacts.map((c) => ({ value: c.id, label: c.name, group: c.group, detail: c.detail }));
  const nothing = contacts.length === 0 && !canInstitution;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <MessageSquarePlus aria-hidden /> Nouvelle conversation
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle conversation"
        description={
          canInstitution
            ? `Écrivez à une personne, ou au nom de ${sender} à un établissement ou à un service.`
            : "Les destinataires proposés sont les personnes liées à votre scolarité ou à votre établissement."
        }
        size="lg"
      >
        {nothing ? (
          <p className="text-sm text-muted">Aucun contact pour le moment. Vos contacts apparaissent dès qu&apos;un enfant ou une classe est rattaché à votre compte.</p>
        ) : (
          <ActionForm action={startConversation} successToast={false} className="flex flex-col gap-4">
            <FormRecovery />
            <input type="hidden" name="mode" value={mode} />
            {canInstitution && (
              <fieldset>
                <legend className="text-sm font-semibold">À qui écrivez-vous ?</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      { value: "person", label: "Une personne", hint: "Un parent, un enseignant, un chef d'établissement…", Icon: UserRound, disabled: contacts.length === 0 },
                      { value: "institution", label: "Un établissement ou un service", hint: `Au nom de ${sender}`, Icon: Building2, disabled: false },
                    ] as const
                  ).map((o) => (
                    <label
                      key={o.value}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border border-border-strong bg-surface px-3 py-2 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-2 has-focus-visible:ring-primary",
                        o.disabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <input type="radio" name="mode-choice" value={o.value} checked={mode === o.value} disabled={o.disabled} onChange={() => setMode(o.value)} className="sr-only" />
                      <o.Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                      <span>
                        <span className="block text-sm font-semibold">{o.label}</span>
                        <span className="block text-xs text-muted">{o.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {mode === "person" ? (
              <>
                <MultiPicker
                  name="recipientIds"
                  legend="Destinataires"
                  hint="Une personne, ou plusieurs pour leur envoyer le même message."
                  options={people}
                  selected={person}
                  onChange={setPerson}
                  max={MAX_RECIPIENTS}
                  searchPlaceholder="Rechercher une personne…"
                />
                {shareable && (
                  <Switch
                    name="shared"
                    value="on"
                    checked={shared}
                    onChange={(e) => setShared(e.target.checked)}
                    label="Une seule conversation pour tout le groupe"
                    description="Chacun voit les autres destinataires et lit toutes les réponses. Décochez pour écrire à chacun séparément."
                  />
                )}
                {separate && (
                  <p role="status" className="rounded-control border border-border bg-surface-2 px-3 py-2 text-sm">
                    {family || person.some((id) => familyOf.get(id))
                      ? `Chaque personne reçoit sa propre conversation : les ${person.length} destinataires ne se voient pas entre eux et chacun vous répond en privé.`
                      : `Chaque personne reçoit sa propre conversation (${person.length} en tout).`}
                  </p>
                )}
              </>
            ) : (
              <MultiPicker
                name="institutions"
                legend="Destinataires"
                hint="Cochez-en plusieurs pour un envoi groupé : chacun reçoit sa propre conversation et vous voyez qui l'a lue."
                options={institutions}
                selected={picked}
                onChange={setPicked}
                max={MAX_INSTITUTION_RECIPIENTS}
                searchPlaceholder="Rechercher un établissement, une circonscription…"
              />
            )}
            {showQuick && mode === "person" && (
              <fieldset>
                <legend className="text-sm font-semibold">Messages rapides</legend>
                <p className="text-xs text-muted">Un appui remplit le sujet et le message.</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {QUICK_MESSAGES.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      aria-pressed={body === q.text}
                      onClick={() => {
                        setBody(q.text);
                        setSubject(q.subject);
                      }}
                      className="flex min-h-12 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2 text-left text-sm font-semibold hover:bg-surface-2 aria-pressed:border-primary aria-pressed:bg-primary-soft"
                    >
                      <q.Icon className="size-5 shrink-0 text-primary" aria-hidden /> {q.text}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <FormField label="Sujet" name="subject" required>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
            </FormField>
            <FormField label="Message" name="body" required>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
            </FormField>
            <div className="ds-dialog-actions">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <SubmitButton pendingLabel="Envoi…">
                <SendHorizonal aria-hidden />{" "}
                {mode === "institution" && picked.length > 1 ? `Envoyer à ${picked.length} destinataires` : mode === "person" && person.length > 1 ? `Envoyer à ${person.length} personnes` : "Envoyer"}
              </SubmitButton>
            </div>
          </ActionForm>
        )}
      </Dialog>
    </>
  );
}
