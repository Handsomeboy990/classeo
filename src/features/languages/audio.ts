// Loudness of the synthesised speech. The Fon voice comes back as 16 bit PCM
// WAV, often quiet: on a laptop speaker it is hard to hear while a phone
// held to the ear is fine. Peak normalisation brings every clip to the same
// level before it is cached. Pure, no dependency.

function findChunk(view: DataView, id: string, from = 12) {
  let offset = from;
  while (offset + 8 <= view.byteLength) {
    const name = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
    const size = view.getUint32(offset + 4, true);
    if (name === id) return { start: offset + 8, size: Math.min(size, view.byteLength - offset - 8) };
    offset += 8 + size + (size % 2);
  }
  return null;
}

// Returns a copy of the WAV scaled so that its loudest sample reaches
// `target` of full scale, with the gain capped at `maxGain` so that silence
// and noise are not blown up. Anything that is not 16 bit PCM WAV is
// returned untouched.
export function normaliseWav(input: Uint8Array, target = 0.89, maxGain = 6): Uint8Array {
  if (input.byteLength < 44) return input;
  const bytes = new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const wave = String.fromCharCode(...bytes.slice(8, 12));
  if (riff !== "RIFF" || wave !== "WAVE") return input;
  const fmt = findChunk(view, "fmt ");
  const data = findChunk(view, "data");
  if (!fmt || !data || fmt.size < 16) return input;
  const format = view.getUint16(fmt.start, true);
  const bits = view.getUint16(fmt.start + 14, true);
  if (format !== 1 || bits !== 16) return input;

  const count = Math.floor(data.size / 2);
  let peak = 0;
  for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(view.getInt16(data.start + i * 2, true)));
  if (peak === 0) return input;
  const gain = Math.min(maxGain, (target * 32767) / peak);
  if (gain <= 1.02) return input;
  for (let i = 0; i < count; i++) {
    const at = data.start + i * 2;
    const v = Math.round(view.getInt16(at, true) * gain);
    view.setInt16(at, Math.max(-32768, Math.min(32767, v)), true);
  }
  return bytes;
}
