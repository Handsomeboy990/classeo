// Kora, the voice of Classéo. Browser speech synthesis with a deliberate
// choice of voice: a French female voice, preferring the natural (neural)
// voices shipped by Edge, Chrome, macOS, iOS and Android, and never a male
// voice when a female one exists. Text is spoken sentence by sentence: long
// utterances get cut off after about fifteen seconds in Chrome, and short
// ones sound more natural and can be stopped at once.

// Ordered by quality. Matched case insensitively against the voice name.
const PREFERRED_FEMALE = [
  "denise", // Microsoft Denise Online (Natural), Edge, Windows
  "eloise", // Microsoft Eloise Online (Natural)
  "vivienne", // Microsoft Vivienne Multilingual (Natural)
  "brigitte",
  "coralie",
  "jacqueline",
  "josephine",
  "yvette",
  "google français", // Chrome desktop, female
  "amélie",
  "amelie",
  "audrey",
  "aurélie",
  "aurelie",
  "marie",
  "julie",
  "hortense",
  "virginie",
  "céline",
  "celine",
  "léa",
  "lea",
  "fr-fr-x-frc", // Android Google TTS, female variants
  "fr-fr-x-vlf",
];

const MALE = ["thomas", "paul", "henri", "nicolas", "daniel", "jacques", "claude", "remy", "rémy", "jean", "antoine", "alain", "fabrice", "yves", "mathieu", "reed", "fr-fr-x-frd", "fr-fr-x-fre"];

function score(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  if (MALE.some((m) => name.includes(m))) return -1;
  const rank = PREFERRED_FEMALE.findIndex((f) => name.includes(f));
  let s = rank === -1 ? 10 : 100 - rank;
  if (name.includes("natural") || name.includes("neural") || name.includes("online")) s += 50;
  if (voice.lang === "fr-FR") s += 5;
  if (!voice.localService) s += 2;
  return s;
}

export function pickVoice(voices: SpeechSynthesisVoice[]) {
  const french = voices.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  const ranked = french.map((v) => ({ v, s: score(v) })).sort((a, b) => b.s - a.s);
  const best = ranked.find((r) => r.s >= 0) ?? ranked[0];
  return best?.v ?? null;
}

// Voices load asynchronously in Chrome: wait for them once.
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
function loadVoices() {
  voicesReady ??= new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const now = synth.getVoices();
    if (now.length) return resolve(now);
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
  return voicesReady;
}

export function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;])\s+(?=[A-ZÀ-Ý0-9«])/u)
    .flatMap((s) => (s.length > 220 ? s.split(/(?<=,)\s+/) : [s]))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function rate() {
  try {
    return Number(localStorage.getItem("classeo:voice-rate")) || 0.95;
  } catch {
    return 0.95;
  }
}

let session = 0;

// Speaks the text; resolves when finished or stopped. Starting a new reading
// stops the previous one.
export async function speak(text: string, onEnd?: () => void) {
  const synth = window.speechSynthesis;
  const mine = ++session;
  synth.cancel();
  const voice = pickVoice(await loadVoices());
  const parts = splitSentences(text);
  let index = 0;
  const next = () => {
    if (mine !== session) return;
    if (index >= parts.length) return onEnd?.();
    const u = new SpeechSynthesisUtterance(parts[index++]);
    u.lang = voice?.lang ?? "fr-FR";
    if (voice) u.voice = voice;
    u.rate = rate();
    u.pitch = 1.05;
    u.volume = 1;
    u.onend = next;
    u.onerror = () => (mine === session ? onEnd?.() : undefined);
    synth.speak(u);
  };
  next();
}

export function stop() {
  session++;
  if (isSupported()) window.speechSynthesis.cancel();
}
