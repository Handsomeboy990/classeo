"use client";

import { Check, ChevronRight, Landmark } from "lucide-react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { cn } from "@/lib/utils";

import { switchSchool } from "./school-actions";

export type PickableSchool = { id: string; name: string; logoUrl: string | null };

export function SchoolLogo({ url, className }: { url: string | null; className?: string }) {
  return (
    <span className={cn("inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2", className)}>
      {url ? (
        // The logo is served by the authorized files route, never optimised
        // by a third party.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-contain" />
      ) : (
        <Landmark className="size-6 text-muted" aria-hidden />
      )}
    </span>
  );
}

// One button per school: choosing it sets the school of this session.
export function SchoolPicker({ schools, activeId, next }: { schools: PickableSchool[]; activeId: string | null; next?: string }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {schools.map((s) => {
        const current = s.id === activeId;
        return (
          <li key={s.id}>
            <ActionForm action={switchSchool} successToast={false}>
              <input type="hidden" name="schoolId" value={s.id} />
              {next && <input type="hidden" name="next" value={next} />}
              <SubmitButton
                variant="secondary"
                pendingLabel="Ouverture…"
                className={cn("h-auto min-h-20 w-full justify-start gap-4 px-4 py-3 text-left", current && "border-primary bg-primary-soft")}
                aria-label={`Travailler à ${s.name}${current ? ", établissement actuel" : ""}`}
              >
                <SchoolLogo url={s.logoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-bold whitespace-normal">{s.name}</span>
                  {current && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-primary">
                      <Check className="size-3.5" aria-hidden /> Établissement actuel
                    </span>
                  )}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
              </SubmitButton>
            </ActionForm>
          </li>
        );
      })}
    </ul>
  );
}
