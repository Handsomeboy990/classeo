import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { distributePaid, invoiceStatus } from "../../src/lib/domain/payments";

import type { SeedContext } from "./index";

// Demonstration data of parent payments and electronic signatures. Keep it
// deterministic: no randomness, fixed dates.
//
// - CEG Godomey publishes two Mobile Money numbers and a bank account; the
//   primary school EPP has none, so its parents are told to pay at school.
// - Sènami's invoice: 7 500 FCFA paid at the counter, a Mobile Money
//   transfer of 5 000 FCFA declared and confirmed (a real Payment through the
//   waterfall), one declaration rejected (reference not found), two awaiting
//   the accountant.
// - The head of CEG Godomey, Florentin Agossou, has a drawn looking
//   signature and a round stamp, generated here as transparent PNG images and
//   marked as a demonstration.

// ---------------------------------------------------------------------------
// A tiny PNG writer and rasteriser: strokes with soft edges, enough for a
// signature and a stamp without an image library.
// ---------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

class Raster {
  readonly alpha: Float32Array;
  constructor(
    readonly width: number,
    readonly height: number,
    readonly rgb: [number, number, number],
  ) {
    this.alpha = new Float32Array(width * height);
  }

  // A disc with an anti-aliased edge.
  dot(cx: number, cy: number, r: number, strength = 1) {
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const cover = Math.max(0, Math.min(1, r - d + 0.5)) * strength;
        const i = y * this.width + x;
        if (cover > this.alpha[i]!) this.alpha[i] = cover;
      }
  }

  // A polyline drawn with discs every half pixel, the width varying along it.
  line(points: [number, number][], width: (t: number) => number, strength = 1) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
    let run = 0;
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1]!;
      const [bx, by] = points[i]!;
      const len = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(len * 2));
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        this.dot(ax + (bx - ax) * f, ay + (by - ay) * f, width((run + len * f) / total) / 2, strength);
      }
      run += len;
    }
  }

  ring(cx: number, cy: number, r: number, w: number, strength = 1) {
    const pts: [number, number][] = [];
    for (let a = 0; a <= 360; a += 0.5) pts.push([cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]);
    this.line(pts, () => w, strength);
  }

  png() {
    const raw = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      const row = y * (this.width * 4 + 1);
      raw[row] = 0;
      for (let x = 0; x < this.width; x++) {
        const o = row + 1 + x * 4;
        raw[o] = this.rgb[0];
        raw[o + 1] = this.rgb[1];
        raw[o + 2] = this.rgb[2];
        raw[o + 3] = Math.round(this.alpha[y * this.width + x]! * 255);
      }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  }
}

// Cubic Bezier sampled into points.
function bezier(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], n = 40): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]] as [number, number];
  });
}

function path(...segments: [number, number][][]) {
  return segments.flatMap((s, i) => (i === 0 ? s : s.slice(1)));
}

// A handwritten looking "FAgossou" with a flourish, in dark blue ink.
function signaturePng() {
  const r = new Raster(640, 240, [16, 35, 90]);
  const pen = (t: number) => 3.2 + 2.2 * Math.sin(Math.PI * t); // thin at both ends
  // F: stem, top bar with a hook, middle bar.
  r.line(path(bezier([92, 188], [100, 140], [112, 90], [128, 52])), pen);
  r.line(path(bezier([84, 66], [130, 40], [190, 38], [226, 48])), pen);
  r.line(path(bezier([100, 124], [124, 116], [150, 112], [176, 116])), pen);
  // A: two legs and a loop joining the rest of the name.
  r.line(path(bezier([168, 186], [190, 130], [206, 96], [222, 70]), bezier([222, 70], [238, 110], [248, 150], [262, 184])), pen);
  r.line(path(bezier([186, 146], [206, 140], [226, 138], [246, 142])), pen);
  // "gossou" as a running wave with loops.
  const wave: [number, number][] = [];
  for (let x = 262; x <= 540; x += 1) {
    const t = (x - 262) / 278;
    const y = 160 - 22 * Math.sin(t * Math.PI * 7) * (1 - 0.35 * t) - 10 * Math.sin(t * Math.PI);
    wave.push([x + 9 * Math.cos(t * Math.PI * 7), y]);
  }
  r.line(wave, (t) => 2.6 + 1.8 * Math.sin(Math.PI * t));
  // g descender loop.
  r.line(path(bezier([300, 170], [316, 214], [270, 232], [262, 206]), bezier([262, 206], [258, 190], [300, 184], [330, 188])), pen);
  // Underline flourish.
  r.line(path(bezier([70, 212], [220, 196], [420, 226], [596, 196])), (t) => 1.6 + 2.6 * Math.sin(Math.PI * t));
  return r.png();
}

// 5 by 7 capitals, enough for the stamp texts.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
};

// Draws a glyph centred on (cx, cy), its up direction at angle `up`
// (radians, 0 pointing right), each lit cell a small disc.
function glyph(r: Raster, ch: string, cx: number, cy: number, cell: number, up: number) {
  const rows = GLYPHS[ch] ?? GLYPHS[" "]!;
  const ux = Math.cos(up);
  const uy = Math.sin(up);
  // Right of the glyph: up turned a quarter clockwise on screen.
  const rx = -uy;
  const ry = ux;
  rows.forEach((row, gy) =>
    [...row].forEach((bit, gx) => {
      if (bit !== "1") return;
      const dx = (gx - 2) * cell;
      const dy = (3 - gy) * cell;
      r.dot(cx + rx * dx + ux * dy, cy + ry * dx + uy * dy, cell * 0.62, 0.92);
    }),
  );
}

function arcText(r: Raster, text: string, cx: number, cy: number, radius: number, cell: number, top: boolean) {
  const advance = (cell * 6.4) / radius; // angle per character
  const span = advance * (text.length - 1);
  [...text].forEach((ch, i) => {
    // Top: left to right over the top (angles from -90 degrees outwards);
    // bottom: left to right under the centre, letters upright.
    const a = top ? -Math.PI / 2 - span / 2 + i * advance : Math.PI / 2 + span / 2 - i * advance;
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    glyph(r, ch, x, y, cell, top ? a : a + Math.PI);
  });
}

function lineText(r: Raster, text: string, cx: number, cy: number, cell: number) {
  const width = (text.length - 1) * cell * 6.4;
  [...text].forEach((ch, i) => glyph(r, ch, cx - width / 2 + i * cell * 6.4, cy, cell, -Math.PI / 2));
}

// A round office stamp in blue ink, marked DEMO.
function stampPng() {
  const size = 400;
  const c = size / 2;
  const r = new Raster(size, size, [31, 58, 147]);
  r.ring(c, c, 186, 7, 0.9);
  r.ring(c, c, 168, 2.5, 0.9);
  r.ring(c, c, 104, 2.5, 0.9);
  arcText(r, "CEG GODOMEY", c, c, 137, 5, true);
  arcText(r, "ABOMEY-CALAVI", c, c, 137, 5, false);
  glyph(r, "*", c - 150, c, 4, -Math.PI / 2);
  glyph(r, "*", c + 150, c, 4, -Math.PI / 2);
  lineText(r, "DIRECTION", c, c - 26, 3.3);
  lineText(r, "DEMO", c, c + 22, 6);
  return r.png();
}

// ---------------------------------------------------------------------------

function blob(ownerUserId: string, purpose: string, fileName: string, data: Buffer) {
  return { ownerUserId, purpose, fileName, mimeType: "image/png", size: data.length, sha256: createHash("sha256").update(data).digest("hex"), data: new Uint8Array(data) };
}

const DAY = (iso: string) => new Date(iso);

export async function seedPaymentsAndSignatures(db: PrismaClient, ctx: SeedContext) {
  // Payment accounts of CEG Godomey. The numbers are demonstration numbers.
  await db.schoolPaymentAccount.createMany({
    data: [
      { schoolId: ctx.schools.ceg, channel: "MOBILE_MONEY", provider: "MTN MoMo", accountName: "CEG Godomey", accountNumber: "01 97 00 12 34", instructions: "Indiquez le nom et la classe de l'élève en motif du transfert." },
      { schoolId: ctx.schools.ceg, channel: "MOBILE_MONEY", provider: "Moov Money", accountName: "CEG Godomey", accountNumber: "01 95 00 56 78", instructions: "Indiquez le nom et la classe de l'élève en motif du transfert." },
      { schoolId: ctx.schools.ceg, channel: "BANK", provider: "Banque de démonstration", accountName: "CEG Godomey, compte des frais scolaires", accountNumber: "BJ066 01001 000000000000 00", instructions: "Virement sous 48 heures ouvrées. Gardez l'avis de virement." },
    ],
  });

  // Signature and stamp of the head of CEG Godomey.
  const signature = await db.fileBlob.create({ data: blob(ctx.ids.director, "signature", "signature-demo.png", signaturePng()), select: { id: true } });
  const stamp = await db.fileBlob.create({ data: blob(ctx.ids.director, "stamp", "cachet-demo.png", stampPng()), select: { id: true } });
  await db.userSignature.create({ data: { userId: ctx.ids.director, signatureFileId: signature.id, stampFileId: stamp.id } });

  // Sènami's invoice of the active year.
  const student = await db.student.findUnique({ where: { userId: ctx.ids.student }, select: { id: true } });
  const invoice = student
    ? await db.invoice.findFirst({ where: { schoolId: ctx.schools.ceg, enrollment: { studentId: student.id, academicYearId: ctx.yearId } }, include: { installments: true, payments: { orderBy: { paidAt: "asc" } } } })
    : null;
  if (!invoice) return;

  // 7 500 FCFA paid at the counter on 16 September, whatever the general
  // seed drew for this invoice.
  const counterAt = DAY("2026-09-16T08:20:00Z");
  const [first, ...others] = invoice.payments;
  if (others.length) await db.payment.deleteMany({ where: { id: { in: others.map((p) => p.id) } } });
  if (first) await db.payment.update({ where: { id: first.id }, data: { amount: 7500, method: "CASH", transactionId: null, paidAt: counterAt, createdAt: counterAt, recordedById: ctx.ids.accountant } });

  // The confirmed transfer becomes a Payment with the next receipt number.
  const last = await db.payment.findFirst({ where: { reference: { startsWith: "PAY-2026-" } }, orderBy: { reference: "desc" }, select: { reference: true } });
  let next = (Number.parseInt(last?.reference.slice(9) ?? "0", 10) || 0) + 1;
  if (!first)
    await db.payment.create({ data: { reference: `PAY-2026-${String(next++).padStart(5, "0")}`, invoiceId: invoice.id, amount: 7500, method: "CASH", paidAt: counterAt, createdAt: counterAt, recordedById: ctx.ids.accountant } });
  const confirmedAt = DAY("2026-09-24T09:40:00Z");
  const confirmedPayment = await db.payment.create({
    data: { reference: `PAY-2026-${String(next).padStart(5, "0")}`, invoiceId: invoice.id, amount: 5000, method: "MOBILE_MONEY", transactionId: "MP2609231402C41852", paidAt: DAY("2026-09-23T13:02:00Z"), createdAt: confirmedAt, recordedById: ctx.ids.accountant },
  });

  // Installments and invoice recomputed with the waterfall rule of the app.
  const today = DAY("2026-09-25T00:00:00Z");
  const paid = 12_500;
  const allocation = distributePaid(invoice.installments, paid, today);
  for (const a of allocation) await db.invoiceInstallment.update({ where: { id: a.id }, data: { paidAmount: a.paidAmount, status: a.status } });
  const byId = new Map(allocation.map((a) => [a.id, a.paidAmount]));
  await db.invoice.update({
    where: { id: invoice.id },
    data: {
      paidAmount: paid,
      status: invoiceStatus({ totalAmount: invoice.totalAmount, paidAmount: paid, dueDate: invoice.dueDate, installments: invoice.installments.map((i) => ({ ...i, paidAmount: byId.get(i.id)! })), today }),
    },
  });

  const wallets = await db.schoolPaymentAccount.findMany({ where: { schoolId: ctx.schools.ceg, channel: "MOBILE_MONEY" }, select: { id: true, provider: true } });
  const mtn = wallets.find((w) => w.provider === "MTN MoMo")!;
  const moov = wallets.find((w) => w.provider === "Moov Money")!;
  await db.paymentDeclaration.createMany({
    data: [
      {
        invoiceId: invoice.id,
        accountId: mtn.id,
        amount: 5000,
        method: "MOBILE_MONEY",
        payerPhone: "0196123456",
        transactionRef: "MP2609231402C41852",
        status: "CONFIRMED",
        declaredById: ctx.ids.parent,
        decidedById: ctx.ids.accountant,
        decidedAt: confirmedAt,
        paymentId: confirmedPayment.id,
        createdAt: DAY("2026-09-23T13:10:00Z"),
      },
      {
        invoiceId: invoice.id,
        accountId: moov.id,
        amount: 3000,
        method: "MOBILE_MONEY",
        payerPhone: "0196123456",
        transactionRef: "MV2609211877",
        status: "REJECTED",
        declaredById: ctx.ids.parent,
        decidedById: ctx.ids.accountant,
        decidedAt: DAY("2026-09-22T15:30:00Z"),
        note: "Transaction introuvable sur le relevé Moov Money du 21 septembre. Vérifiez la référence du SMS.",
        createdAt: DAY("2026-09-21T18:05:00Z"),
      },
      {
        invoiceId: invoice.id,
        accountId: mtn.id,
        amount: 4500,
        method: "MOBILE_MONEY",
        payerPhone: "0196123456",
        transactionRef: "MP2609250815D77310",
        status: "PENDING",
        declaredById: ctx.ids.parent,
        createdAt: DAY("2026-09-25T07:15:00Z"),
      },
      {
        invoiceId: invoice.id,
        accountId: moov.id,
        amount: 1500,
        method: "MOBILE_MONEY",
        payerPhone: "0196123456",
        transactionRef: "MV2609250902",
        status: "PENDING",
        declaredById: ctx.ids.parent,
        createdAt: DAY("2026-09-25T08:02:00Z"),
      },
    ],
  });
}
