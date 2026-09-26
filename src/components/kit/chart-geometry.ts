// Geometry shared by the charts (kit/line-chart-plot.tsx), kept pure so it
// can be tested without a browser.

export type Point = readonly [number, number];

// Round, readable scale bounds: 0 to 20 stays 0 to 20, 0 to 2 760 becomes
// 0 to 3 000 with a step of 750.
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

// Smooth path through the points without overshooting them (monotone cubic
// interpolation, Fritsch and Carlson): a mark never looks higher or lower
// between two periods than it was.
export function smoothPath(points: Point[]): string {
  const n = points.length;
  if (n === 0) return "";
  const f = (v: number) => v.toFixed(1);
  if (n === 1) return `M${f(points[0]![0])},${f(points[0]![1])}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1]![0] - points[i]![0]);
    slope.push((points[i + 1]![1] - points[i]![1]) / (dx[i] || 1));
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) tangent.push(slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2);
  tangent.push(slope[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i]! / slope[i]!;
    const b = tangent[i + 1]! / slope[i]!;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * slope[i]!;
      tangent[i + 1] = t * b * slope[i]!;
    }
  }
  let d = `M${f(points[0]![0])},${f(points[0]![1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const h = dx[i]! / 3;
    d += `C${f(x0 + h)},${f(y0 + tangent[i]! * h)} ${f(x1 - h)},${f(y1 - tangent[i + 1]! * h)} ${f(x1)},${f(y1)}`;
  }
  return d;
}

// Runs of consecutive values: a missing period breaks the line.
export function segments(values: (number | null)[]): { start: number; values: number[] }[] {
  const out: { start: number; values: number[] }[] = [];
  values.forEach((v, i) => {
    if (v === null) return;
    const last = out[out.length - 1];
    if (last && last.start + last.values.length === i) last.values.push(v);
    else out.push({ start: i, values: [v] });
  });
  return out;
}

// Every how many labels to write on an axis so that they never touch.
export function labelStep(count: number, width: number, minGap = 64) {
  if (count <= 1) return 1;
  return Math.max(1, Math.ceil(count / Math.max(1, Math.floor(width / minGap))));
}
