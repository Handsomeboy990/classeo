import { deflateSync } from "node:zlib";

// Neutral placeholder portraits for demonstration data: the initials of a
// name drawn in white on a coloured square, encoded as a PNG with no image
// library. Never a photo of a real person.

// 5 x 7 bitmap capitals, one string per row, "#" for a lit pixel.
const GLYPHS: Record<string, string[]> = {
  A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  B: ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  C: [" ### ", "#   #", "#    ", "#    ", "#    ", "#   #", " ### "],
  D: ["#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
  E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  F: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  G: [" ### ", "#   #", "#    ", "# ###", "#   #", "#   #", " ####"],
  H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  I: [" ### ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  J: ["  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " ##  "],
  K: ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  L: ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  M: ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"],
  N: ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
  O: [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  Q: [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  U: ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  V: ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  W: ["#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #"],
  X: ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
  Y: ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
  Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
};

// Muted, dark enough for white initials to pass the AA contrast ratio.
const PALETTE: [number, number, number][] = [
  [0, 107, 64],
  [11, 59, 42],
  [36, 84, 140],
  [120, 61, 18],
  [98, 52, 120],
  [140, 40, 60],
  [30, 98, 110],
  [84, 90, 30],
];

export function initialsOf(firstName: string, lastName: string) {
  const letter = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .charAt(0);
  return `${letter(firstName)}${letter(lastName)}` || "?";
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// A square PNG (RGB, 8 bits) with the initials centred. Deterministic: the
// same name always gives the same bytes.
export function initialsAvatarPng(firstName: string, lastName: string, size = 160) {
  const text = initialsOf(firstName, lastName);
  const [br, bg, bb] = PALETTE[hash(`${firstName} ${lastName}`) % PALETTE.length]!;
  const scale = Math.max(1, Math.floor(size / 16));
  const glyphs = [...text].map((ch) => GLYPHS[ch]).filter((g): g is string[] => !!g);
  const gap = scale * 2;
  const textWidth = glyphs.length * 5 * scale + Math.max(0, glyphs.length - 1) * gap;
  const left = Math.floor((size - textWidth) / 2);
  const top = Math.floor((size - 7 * scale) / 2);

  const lit = (x: number, y: number) => {
    const gy = Math.floor((y - top) / scale);
    if (gy < 0 || gy > 6) return false;
    const rel = x - left;
    if (rel < 0) return false;
    const cell = 5 * scale + gap;
    const index = Math.floor(rel / cell);
    const glyph = glyphs[index];
    if (!glyph) return false;
    const gx = Math.floor((rel - index * cell) / scale);
    return gx >= 0 && gx < 5 && glyph[gy]![gx] === "#";
  };

  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const on = lit(x, y);
      const o = row + 1 + x * 3;
      raw[o] = on ? 255 : br;
      raw[o + 1] = on ? 255 : bg;
      raw[o + 2] = on ? 255 : bb;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array())]);
}
