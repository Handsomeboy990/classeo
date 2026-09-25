import { cn } from "@/lib/utils";

// Brand motifs of the public pages (home, sign in), shared so both show the
// same bright flag yellow sun and the same stripe.

// The three colours of the Benin flag, as a thin band.
export function FlagStripe({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-1.5", className)} aria-hidden>
      <span className="w-2/5 bg-[#008751]" />
      <span className="w-2/5 bg-accent" />
      <span className="w-1/5 bg-[#e8112d]" />
    </div>
  );
}

// The rising sun of the logo, drawn as a horizon: decorative only.
export function SunriseMotif({ className, still = false }: { className?: string; still?: boolean }) {
  const rays = Array.from({ length: 11 }, (_, i) => -75 + i * 15);
  return (
    <svg viewBox="0 0 400 210" className={className} aria-hidden focusable="false">
      <g className={cn(!still && "classeo-rise")}>
        <g stroke="#fcd116" strokeWidth="7" strokeLinecap="round" className={cn(!still && "classeo-rays")}>
          {rays.map((deg) => {
            const r = (deg * Math.PI) / 180;
            const x1 = 200 + Math.sin(r) * 128;
            const y1 = 205 - Math.cos(r) * 128;
            const x2 = 200 + Math.sin(r) * 168;
            const y2 = 205 - Math.cos(r) * 168;
            return <line key={deg} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} />;
          })}
        </g>
        <path d="M95 205a105 105 0 0 1 210 0z" fill="#fcd116" />
      </g>
    </svg>
  );
}
