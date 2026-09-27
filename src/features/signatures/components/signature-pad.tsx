"use client";

import { Eraser, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { Button } from "@/components/ui/button";

import { saveDrawnSignature } from "../actions";

type Point = { x: number; y: number; w: number };

const WIDTH = 600;
const HEIGHT = 220;

// The ink is the navy of the mobile bar (--header), dark in both themes:
// the signature is saved as an image and printed on white paper.
function inkColour(el: Element) {
  return getComputedStyle(el).getPropertyValue("--header").trim() || "currentColor";
}

// A pad to draw a signature with a finger, a stylus or a mouse (pointer
// events). The strokes are kept so the last one can be undone; the saved
// image is a transparent PNG cropped to the ink, ready to lay over a stamp.
// Drawing needs a pointer: uploading an image of the signature, on the same
// page, is the keyboard alternative.
export function SignaturePad() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef<Point[] | null>(null);
  const [count, setCount] = useState(0);
  const [data, setData] = useState("");

  const redraw = useCallback(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const ink = inkColour(c);
    ctx.strokeStyle = ink;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) {
      if (s.length === 1) {
        ctx.beginPath();
        ctx.fillStyle = ink;
        ctx.arc(s[0]!.x, s[0]!.y, s[0]!.w / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      // Quadratic curves through the midpoints: a smooth line from sampled
      // points, thinner where the hand moves fast.
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1]!;
        const b = s[i]!;
        const prev = s[i - 2] ?? a;
        ctx.beginPath();
        ctx.lineWidth = (a.w + b.w) / 2;
        ctx.moveTo((prev.x + a.x) / 2, (prev.y + a.y) / 2);
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
        ctx.stroke();
      }
    }
  }, []);

  // The image sent: cropped to the ink with a small margin.
  const exportImage = useCallback(() => {
    const c = canvas.current;
    if (!c || !strokes.current.length) return "";
    const pts = strokes.current.flat();
    const pad = 12;
    const minX = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x)) - pad));
    const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y)) - pad));
    const maxX = Math.min(c.width, Math.ceil(Math.max(...pts.map((p) => p.x)) + pad));
    const maxY = Math.min(c.height, Math.ceil(Math.max(...pts.map((p) => p.y)) + pad));
    const out = document.createElement("canvas");
    out.width = Math.max(1, maxX - minX);
    out.height = Math.max(1, maxY - minY);
    out.getContext("2d")!.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  }, []);

  const changed = useCallback(() => {
    redraw();
    setCount(strokes.current.length);
    setData(exportImage());
  }, [redraw, exportImage]);

  useEffect(() => redraw(), [redraw]);

  function point(rect: DOMRect, e: PointerEvent, last?: Point): Point {
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    const speed = last ? Math.hypot(x - last.x, y - last.y) : 0;
    const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    const w = Math.max(1.6, Math.min(5.5, 2 + pressure * 4 - speed * 0.08));
    return { x, y, w: last ? last.w * 0.6 + w * 0.4 : w };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = [point(e.currentTarget.getBoundingClientRect(), e.nativeEvent)];
    strokes.current = [...strokes.current, drawing.current];
    redraw();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const s = drawing.current;
    if (!s) return;
    // Coalesced events: every sample of a fast stroke, not one per frame.
    const rect = e.currentTarget.getBoundingClientRect();
    const coalesced = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    for (const ev of coalesced.length ? coalesced : [e.nativeEvent]) s.push(point(rect, ev, s[s.length - 1]));
    redraw();
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = null;
    changed();
  }

  function undo() {
    strokes.current = strokes.current.slice(0, -1);
    changed();
  }

  function clear() {
    strokes.current = [];
    changed();
  }

  return (
    <ActionForm action={saveDrawnSignature} onSuccess={clear} className="flex flex-col gap-3">
      <p id="pad-help" className="text-sm text-muted">
        Signez dans le cadre avec le doigt, un stylet ou la souris. Vous pouvez annuler le dernier trait ou tout effacer avant d&apos;enregistrer.
      </p>
      <div className="overflow-hidden rounded-control border-2 border-dashed border-border-strong bg-white">
        <canvas
          ref={canvas}
          width={WIDTH}
          height={HEIGHT}
          role="img"
          aria-label={count ? `Signature tracée, ${count} trait${count > 1 ? "s" : ""}` : "Cadre de signature, vide"}
          aria-describedby="pad-help"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          className="block aspect-[60/22] w-full cursor-crosshair touch-none"
        />
      </div>
      <input type="hidden" name="drawing" value={data} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={undo} disabled={!count}>
          <Undo2 aria-hidden /> Annuler le dernier trait
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!count}>
          <Eraser aria-hidden /> Tout effacer
        </Button>
        <SubmitButton className="ml-auto" disabled={!count} pendingLabel="Enregistrement…">
          Enregistrer cette signature
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
