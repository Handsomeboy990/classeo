"use client";

import { CheckCircle2, FileSearch, XCircle } from "lucide-react";
import { useId, useState } from "react";

// Compares a file in hand with the register, in the browser: the file is
// hashed locally (SHA-256) and never sent anywhere.
export function FileCheck({ expected }: { expected: string }) {
  const id = useId();
  const [result, setResult] = useState<"match" | "differs" | "busy" | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult("busy");
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    setResult(hex === expected ? "match" : "differs");
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="inline-flex items-center gap-2 text-sm font-semibold text-text">
        <FileSearch className="size-4" aria-hidden /> Comparer avec le fichier PDF que vous avez reçu
      </label>
      <input id={id} type="file" accept="application/pdf" onChange={onChange} className="max-w-full text-sm file:mr-3 file:rounded-control file:border file:border-border-strong file:bg-surface file:px-3 file:py-2 file:font-semibold" />
      <p className="text-xs text-muted">Le fichier reste sur votre appareil : seule son empreinte est calculée, ici, pour la comparer au registre.</p>
      <div aria-live="polite">
        {result === "match" && (
          <p className="flex items-center gap-2 rounded-control bg-success-soft px-3 py-2 text-sm font-semibold text-success">
            <CheckCircle2 className="size-4" aria-hidden /> Fichier identique à l&apos;original : il n&apos;a pas été modifié.
          </p>
        )}
        {result === "differs" && (
          <p className="flex items-center gap-2 rounded-control bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
            <XCircle className="size-4" aria-hidden /> Ce fichier ne correspond pas à l&apos;original : il a été modifié ou il s&apos;agit d&apos;un autre document.
          </p>
        )}
        {result === "busy" && <p className="text-sm text-muted">Calcul de l&apos;empreinte…</p>}
      </div>
    </div>
  );
}
