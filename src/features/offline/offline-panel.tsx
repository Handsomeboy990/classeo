"use client";

import { AlertTriangle, CloudUpload, Download, FileText, Pencil, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { toast } from "@/components/kit/toaster";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

import { discardEntry, isDataSaverOn, readOfflineState, requestOfflinePages, syncNow, useOfflineEntries, type OfflineState } from "./client";

const STOPPED: Record<string, string> = {
  budget: "La place prévue sur cet appareil est atteinte : les pages suivantes ne sont pas gardées.",
  network: "Le réseau a manqué pendant le téléchargement : la suite sera reprise plus tard.",
  session: "La session a pris fin pendant le téléchargement.",
};

const noSubscribe = () => () => undefined;

function useOfflineState() {
  const [state, setState] = useState<OfflineState | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const load = () => void readOfflineState().then((s) => alive && setState(s), () => alive && setState(null));
    load();
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "offline-precache") setState(event.data.state as OfflineState);
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      alive = false;
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);
  return state;
}

// Préférences, "Hors ligne": what this device keeps for the signed in
// account, and the entries typed without network (waiting, or refused and
// to review).
export function OfflinePanel() {
  const state = useOfflineState();
  const entries = useOfflineEntries();
  const saveData = useSyncExternalStore(noSubscribe, isDataSaverOn, () => false);
  const pending = entries.filter((e) => e.status !== "rejected");
  const rejected = entries.filter((e) => e.status === "rejected");

  async function refresh() {
    if (await requestOfflinePages(undefined, true)) toast("success", "Mise à jour lancée : les pages se téléchargent en arrière-plan.");
    else toast("error", "La mise à jour n'a pas pu démarrer. Rechargez la page avec du réseau, puis réessayez.");
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="offline-review" className="flex flex-col gap-3">
        <h3 id="offline-review" className="font-sans text-base font-bold">
          À revoir
        </h3>
        {rejected.length ? (
          <ul className="flex flex-col gap-3">
            {rejected.map((e) => (
              <li key={e.clientId} className="rounded-control border border-danger/30 bg-danger-soft p-3 text-sm">
                <p className="flex items-start gap-2 font-semibold">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> {e.label}
                </p>
                <p className="mt-1 text-muted">Saisi le {formatDateTime(new Date(e.createdAt))}</p>
                <p className="mt-1">{e.error}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={e.page} className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-3.5 text-sm font-semibold text-on-primary sm:min-h-9">
                    <Pencil className="size-4" aria-hidden /> Rouvrir pour corriger
                  </Link>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Abandonner cette saisie ? Les valeurs gardées sur cet appareil seront effacées.")) void discardEntry(e.clientId);
                    }}
                  >
                    <Trash2 aria-hidden /> Abandonner
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aucune saisie refusée.</p>
        )}
      </section>

      <section aria-labelledby="offline-pending" className="flex flex-col gap-3">
        <h3 id="offline-pending" className="font-sans text-base font-bold">
          En attente d&apos;envoi
        </h3>
        {pending.length ? (
          <>
            <ul className="flex flex-col gap-2">
              {pending.map((e) => (
                <li key={e.clientId} className="flex items-start gap-2 rounded-control border border-dashed border-warning bg-warning-soft p-3 text-sm">
                  <CloudUpload className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <span>
                    <span className="font-semibold">{e.label}</span>
                    <span className="block text-muted">Saisi le {formatDateTime(new Date(e.createdAt))}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" className="self-start" onClick={() => void syncNow()}>
              <RefreshCw aria-hidden /> Envoyer maintenant
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">Rien en attente : tout ce que vous avez saisi est enregistré.</p>
        )}
      </section>

      <section aria-labelledby="offline-pages" className="flex flex-col gap-3">
        <h3 id="offline-pages" className="font-sans text-base font-bold">
          Disponible sans réseau sur cet appareil
        </h3>
        {state === undefined ? null : state && state.pages.length ? (
          <>
            <p className="text-sm text-muted">
              {state.running ? "Téléchargement en cours… " : ""}
              {state.updatedAt ? `Dernière mise à jour le ${formatDateTime(new Date(state.updatedAt))}.` : ""}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {state.pages.map((p) => (
                <li key={p.url}>
                  <a href={p.url} className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-surface px-4 text-sm font-semibold hover:border-primary">
                    <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                    {p.title ?? p.url}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted">{state?.running ? "Téléchargement en cours…" : "Aucune page n'est encore gardée sur cet appareil."}</p>
        )}
        {state?.stopped && STOPPED[state.stopped] && <p className="text-sm text-muted">{STOPPED[state.stopped]}</p>}
        {(saveData || state?.saveData) && (
          <p className="text-sm text-muted">
            L&apos;économie de données est activée sur cet appareil : seul le tableau de bord est téléchargé d&apos;avance. Le bouton ci-dessous télécharge toutes vos pages principales.
          </p>
        )}
        <Button variant="secondary" size="sm" className="self-start" onClick={refresh}>
          <Download aria-hidden /> Mettre à jour maintenant
        </Button>
      </section>
    </div>
  );
}
