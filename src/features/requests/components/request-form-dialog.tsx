"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";

import { createRequest } from "../actions";
import { REQUEST_TYPE_LABELS, REQUEST_TYPES } from "../labels";

export function RequestFormDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Send aria-hidden /> Nouvelle demande
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Nouvelle demande au ministère" description="La circonscription, la direction départementale ou le ministère statuera et vous serez notifié.">
        <ActionForm action={createRequest} onSuccess={() => setOpen(false)} resetOnSuccess className="flex flex-col gap-4">
          <FormField label="Type de demande" name="type" required>
            <Select defaultValue="">
              <option value="" disabled>
                Choisir un type
              </option>
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Objet" name="subject" required>
            <Input maxLength={150} autoComplete="off" />
          </FormField>
          <FormField label="Détail de la demande" name="body" required hint="Contexte, besoin chiffré, échéance souhaitée.">
            <Textarea rows={6} maxLength={4000} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton pendingLabel="Envoi…">Envoyer la demande</SubmitButton>
          </div>
        </ActionForm>
      </Dialog>
    </>
  );
}
