"use client";

import { ImagePlus, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { FileInput } from "@/components/ui/file-input";
import { cn } from "@/lib/utils";

// Resizes an image in the browser so a phone photo of several megabytes is
// sent as a light file (weak networks). Transparent images stay PNG.
async function resize(file: File, maxSide: number, keepAlpha: boolean): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = keepAlpha ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
  if (!blob) return file;
  const ext = keepAlpha ? "png" : "jpg";
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type });
}

// File field for photos, logos, signatures and stamps, used inside any
// ActionForm: the (resized) file is submitted under `name`.
export function ImageUpload({
  name,
  label,
  currentUrl,
  maxSide = 800,
  keepAlpha = false,
  accept = "image/jpeg,image/png,image/webp",
  shape = "rounded",
  hint,
}: {
  name: string;
  label: string;
  currentUrl?: string | null;
  maxSide?: number;
  keepAlpha?: boolean;
  accept?: string;
  shape?: "rounded" | "circle" | "wide";
  hint?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const small = await resize(file, maxSide, keepAlpha);
      const dt = new DataTransfer();
      dt.items.add(small);
      e.target.files = dt.files;
      setPreview(URL.createObjectURL(small));
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    if (input.current) input.current.value = "";
    setPreview(currentUrl ?? null);
  }

  const frame = shape === "circle" ? "size-24 rounded-full" : shape === "wide" ? "h-24 w-48 rounded-control" : "size-24 rounded-control";

  return (
    <div className="flex items-center gap-4">
      <div className={cn("flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2", frame)}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-contain" />
        ) : (
          <ImagePlus className="size-7 text-muted" aria-hidden />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={id} className="font-display text-sm font-semibold text-text">
          {label}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <FileInput ref={input} id={id} name={name} accept={accept} onChange={onChange} disabled={busy} placeholder="Choisir une image" className="min-w-0 flex-1" />
          {preview && preview !== currentUrl && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
              <X className="size-4" aria-hidden /> Annuler
            </button>
          )}
        </div>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
