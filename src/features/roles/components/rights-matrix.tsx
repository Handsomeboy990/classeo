"use client";

import { Lock, RotateCcw } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { Button } from "@/components/ui/button";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ACTION_LABELS, ACTIONS, isApplicable, RESOURCES, type Resource } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

import { updateRolePermissions } from "../actions";

type Cell = "editable" | "not-held" | "protected" | "readonly";

// Permission matrix of one role: resources in rows, actions in columns, a
// checkbox only where the action applies to the resource. A permission the
// viewer does not hold is shown but cannot be changed; protected permissions
// stay checked. The server applies the same rules (planRoleUpdate).
export function RightsMatrix({
  role,
  held,
  editable,
  protectedCodes,
}: {
  role: { id: string; name: string; permissions: string[] };
  held: string[];
  editable: boolean;
  protectedCodes: string[];
}) {
  const initial = new Set(role.permissions);
  const [checked, setChecked] = useState(() => new Set(role.permissions));
  const heldSet = new Set(held);
  const added = [...checked].filter((c) => !initial.has(c));
  const removed = [...initial].filter((c) => !checked.has(c));
  const dirty = added.length + removed.length > 0;

  function stateOf(code: string): Cell {
    if (!editable) return "readonly";
    if (protectedCodes.includes(code) && initial.has(code)) return "protected";
    if (!heldSet.has(code)) return "not-held";
    return "editable";
  }

  function toggle(code: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  const resources = Object.keys(RESOURCES) as Resource[];

  const table = (
    // When the grid is wider than its frame it scrolls sideways; the resource
    // column stays pinned so each row keeps its name.
    <Table density="compact">
      <caption className="sr-only">Droits du rôle {role.name} : une ligne par ressource, une colonne par action</caption>
      <THead>
        <tr>
          <TH className="sticky left-0 z-1 bg-surface-2">Ressource</TH>
          {ACTIONS.map((a) => (
            <TH key={a} className="text-center">
              {ACTION_LABELS[a]}
            </TH>
          ))}
        </tr>
      </THead>
      <tbody>
        {resources.map((r) => (
          <TR key={r}>
            <TH scope="row" className="min-w-36 text-left text-sm font-semibold whitespace-normal text-text normal-case sticky left-0 z-1 bg-surface">
              {RESOURCES[r]}
            </TH>
            {ACTIONS.map((a) => {
              if (!isApplicable(r, a))
                return (
                  <TD key={a} className="text-center text-muted">
                    <span aria-hidden>·</span>
                    <span className="sr-only">Non applicable</span>
                  </TD>
                );
              const code = `${r}:${a}`;
              const state = stateOf(code);
              const on = checked.has(code);
              const changed = on !== initial.has(code);
              const label = `${ACTION_LABELS[a]} : ${RESOURCES[r]}`;
              const reason = state === "not-held" ? "Vous ne détenez pas ce droit" : state === "protected" ? "Droit protégé : il ne peut pas être retiré de ce rôle" : undefined;
              return (
                <TD key={a} className={cn("text-center", changed && "bg-accent-soft")}>
                  <span className="inline-flex items-center gap-1" title={reason}>
                    <input
                      type="checkbox"
                      className="size-5 accent-primary disabled:opacity-50"
                      name={state === "editable" ? "permissions[]" : undefined}
                      value={code}
                      checked={on}
                      disabled={state !== "editable"}
                      onChange={(e) => toggle(code, e.target.checked)}
                      aria-label={reason ? `${label} (${reason})` : label}
                    />
                    {state === "protected" && (
                      <>
                        <Lock className="size-3.5 text-muted" aria-hidden />
                        <input type="hidden" name="permissions[]" value={code} />
                      </>
                    )}
                  </span>
                </TD>
              );
            })}
          </TR>
        ))}
      </tbody>
    </Table>
  );

  if (!editable) return table;

  return (
    <ActionForm action={updateRolePermissions} className="flex flex-col gap-4">
      <input type="hidden" name="roleId" value={role.id} />
      {/* Permissions currently on the role that the viewer cannot see as
          editable are kept by the server, not sent. */}
      {table}
      {/* Above the tab bar on a phone, at the bottom of the window from lg.
          An action bar: the floating accessibility button steps aside while
          it is on the page (globals.css). */}
      <div
        data-action-bar
        className="sticky bottom-(--tab-bar-space) z-10 flex flex-col gap-3 rounded-b-card border-t border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:bottom-0"
        aria-live="polite"
      >
        <p className="text-sm text-muted">
          {dirty ? (
            <>
              <span className="font-semibold text-text">{added.length}</span> droit{added.length > 1 ? "s" : ""} ajouté{added.length > 1 ? "s" : ""},{" "}
              <span className="font-semibold text-text">{removed.length}</span> retiré{removed.length > 1 ? "s" : ""}, non enregistrés.
            </>
          ) : (
            "Aucune modification en cours."
          )}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="secondary" disabled={!dirty} onClick={() => setChecked(new Set(role.permissions))}>
            <RotateCcw aria-hidden /> Annuler
          </Button>
          <SubmitButton disabled={!dirty}>Enregistrer les droits</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
