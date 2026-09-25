// A small QR Code encoder (ISO/IEC 18004), enough for the verification links
// printed on documents: byte mode, error correction level M (15 % of the
// symbol can be damaged or stained and still read), versions 1 to 10 (up to
// 213 bytes). Pure, no dependency: it runs in the PDF renderer, in server
// components and in tests. Follows the structure of Project Nayuki's
// reference implementation (MIT).

const MAX_VERSION = 10;
// Level M, indexed by version.
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const FORMAT_M = 0; // format bits of level M

function rawDataModules(ver: number) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(ver: number) {
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver]! * BLOCKS[ver]!;
}

// Capacity in bytes of a version, byte mode: 4 bits of mode and 8 or 16
// bits of length.
export function capacity(ver: number) {
  return Math.floor((dataCodewords(ver) * 8 - 4 - (ver < 10 ? 8 : 16)) / 8);
}

function gfMul(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number) {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j]!, root);
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!;
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => (result[i]! ^= gfMul(coef, factor)));
  }
  return result;
}

function alignmentPositions(ver: number) {
  if (ver === 1) return [];
  const size = ver * 4 + 17;
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function bit(x: number, i: number) {
  return ((x >>> i) & 1) !== 0;
}

class Symbol {
  readonly size: number;
  readonly modules: boolean[][];
  readonly fn: boolean[][];

  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fn = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  set(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark;
    this.fn[y]![x] = true;
  }

  drawFunctionPatterns() {
    const s = this.size;
    for (let i = 0; i < s; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(s - 4, 3);
    this.finder(3, s - 4);
    const pos = alignmentPositions(this.version);
    const n = pos.length;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.set(pos[i]! + dx, pos[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    this.drawFormat(0);
    this.drawVersion();
  }

  finder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) this.set(xx, yy, d !== 2 && d !== 4);
      }
  }

  drawFormat(mask: number) {
    const data = (FORMAT_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const s = this.size;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.set(s - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, s - 15 + i, bit(bits, i));
    this.set(8, s - 8, true);
  }

  drawVersion() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, bit(bits, i));
      this.set(b, a, bit(bits, i));
    }
  }

  drawCodewords(data: number[]) {
    let i = 0;
    const s = this.size;
    for (let right = s - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < s; vert++)
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? s - 1 - vert : vert;
          if (!this.fn[y]![x] && i < data.length * 8) {
            this.modules[y]![x] = bit(data[i >>> 3]!, 7 - (i & 7));
            i++;
          }
        }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        if (this.fn[y]![x]) continue;
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (invert) this.modules[y]![x] = !this.modules[y]![x];
      }
  }

  // Penalty of the four rules of the standard: long runs, 2x2 blocks,
  // finder-like patterns and dark/light imbalance. The lowest wins.
  penalty() {
    const s = this.size;
    const m = this.modules;
    let score = 0;
    const line = (get: (i: number) => boolean) => {
      let run = 1;
      for (let i = 1; i <= s; i++) {
        if (i < s && get(i) === get(i - 1)) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      const seq = Array.from({ length: s }, (_, i) => (get(i) ? 1 : 0)).join("");
      for (const p of ["10111010000", "00001011101"]) {
        let at = seq.indexOf(p);
        while (at !== -1) {
          score += 40;
          at = seq.indexOf(p, at + 1);
        }
      }
    };
    for (let y = 0; y < s; y++) line((i) => m[y]![i]!);
    for (let x = 0; x < s; x++) line((i) => m[i]![x]!);
    for (let y = 0; y < s - 1; y++)
      for (let x = 0; x < s - 1; x++) {
        const c = m[y]![x];
        if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) score += 3;
      }
    let dark = 0;
    for (const row of m) for (const c of row) if (c) dark++;
    const total = s * s;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
}

function encodeData(bytes: Uint8Array, ver: number) {
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capacityBits = dataCodewords(ver) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; out.length < dataCodewords(ver); pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

function addEcc(data: number[], ver: number) {
  const numBlocks = BLOCKS[ver]!;
  const eccLen = ECC_PER_BLOCK[ver]!;
  const raw = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++)
    blocks.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(b[i]!);
    });
  return result;
}

export type QrMatrix = { size: number; version: number; mask: number; modules: boolean[][] };

// Encodes text (UTF-8) into the smallest symbol that holds it. Throws when
// the text is longer than version 10 allows.
export function encodeQr(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  let ver = 1;
  while (ver <= MAX_VERSION && capacity(ver) < bytes.length) ver++;
  if (ver > MAX_VERSION) throw new Error(`QR: text too long (${bytes.length} bytes)`);
  const codewords = addEcc(encodeData(bytes, ver), ver);

  let best: { mask: number; score: number } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const sym = new Symbol(ver);
    sym.drawFunctionPatterns();
    sym.drawCodewords(codewords);
    sym.applyMask(mask);
    sym.drawFormat(mask);
    const score = sym.penalty();
    if (!best || score < best.score) best = { mask, score };
  }
  const sym = new Symbol(ver);
  sym.drawFunctionPatterns();
  sym.drawCodewords(codewords);
  sym.applyMask(best!.mask);
  sym.drawFormat(best!.mask);
  return { size: sym.size, version: ver, mask: best!.mask, modules: sym.modules };
}

// One SVG path drawing every dark module as a 1x1 square, in module units
// (a quiet zone of `margin` modules around). Used by the PDF and HTML views.
export function qrPath(qr: QrMatrix, margin = 4) {
  const parts: string[] = [];
  qr.modules.forEach((row, y) => {
    let x = 0;
    while (x < qr.size) {
      if (!row[x]) {
        x++;
        continue;
      }
      let end = x;
      while (end < qr.size && row[end]) end++;
      parts.push(`M${x + margin} ${y + margin}h${end - x}v1h${x - end}z`);
      x = end;
    }
  });
  return { d: parts.join(""), viewBox: qr.size + margin * 2 };
}
