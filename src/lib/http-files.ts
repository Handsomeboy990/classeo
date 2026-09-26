// Helpers for serving stored files. Pure, unit tested.

// Content-Disposition with a safe name: an ASCII fallback without quotes,
// slashes or control characters, and the full name encoded (RFC 6266), so
// a stored name can never break the header or point to a path.
export function contentDisposition(fileName: string, kind: "inline" | "attachment") {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim() || "fichier";
  const ascii =
    clean
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^A-Za-z0-9._ -]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 120) || "fichier";
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean.slice(0, 120))}`;
}

// One byte range of a "Range: bytes=..." header, both ends included.
// null: no range asked (or several ranges, answered with the whole file);
// "invalid": a range outside the file, answered with 416.
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, a, b] = m;
  if (a === "" && b === "") return null;
  let start: number;
  let end: number;
  if (a === "") {
    // The last b bytes.
    const n = Number(b);
    if (n === 0) return "invalid";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(a);
    end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}
