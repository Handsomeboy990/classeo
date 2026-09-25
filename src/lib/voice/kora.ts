// Kora, the voice of Classéo.
//
// French: browser speech synthesis with a deliberate choice of voice, a
// French female voice, preferring the natural (neural) voices shipped by
// Edge, Chrome, macOS, iOS and Android, and never a male voice when a female
// one exists. On a desktop without such a voice (Chromium or Firefox on
// Linux) the browser only offers the synthetic espeak voice, male and harsh:
// Kora then raises its pitch a little and slows it down, so that it stays
// understandable. Text is spoken sentence by sentence with a short pause in
// between: long utterances get cut off after about fifteen seconds in Chrome,
// and short ones sound more natural and can be stopped at once.
//
// Fon, Yoruba and Hausa: clips synthesised by the server (see
// /api/langues/voix), played one after the other at a normalised level.

// Ordered by quality. Matched case insensitively against the voice name.
const PREFERRED_FEMALE = [
  "denise", // Microsoft Denise Online (Natural), Edge, Windows
  "eloise", // Microsoft Eloise Online (Natural)
  "vivienne", // Microsoft Vivienne Multilingual (Natural)
  "google français", // Chrome desktop (online), female
  "amélie", // macOS, iOS
  "amelie",
  "audrey",
  "aurélie",
  "aurelie",
  "brigitte",
  "coralie",
  "jacqueline",
  "josephine",
  "yvette",
  "hortense", // Microsoft Hortense, Windows desktop
  "julie", // Microsoft Julie
  "marie",
  "virginie",
  "céline",
  "celine",
  "léa",
  "lea",
  "fr-fr-x-frc", // Android Google TTS, female variants
  "fr-fr-x-vlf",
  "fr-fr-language", // Android default, female
];

// Female variants of the synthetic voices (espeak-ng, speech-dispatcher).
const FEMALE_HINTS = ["female", "femme", "woman", "+f1", "+f2", "+f3", "+f4", "+f5", "annie", "anika", "belinda", "linda", "steph", "zira"];

const MALE = ["thomas", "paul", "henri", "nicolas", "daniel", "jacques", "claude", "remy", "rémy", "jean", "antoine", "alain", "fabrice", "yves", "mathieu", "reed", "fr-fr-x-frd", "fr-fr-x-fre", "+m1", "+m2", "+m3", "+m4", "+m5", "male"];

const SYNTHETIC = /espeak|mbrola|speech[- ]?dispatcher|festival|pico|flite/i;

export type VoiceGender = "female" | "male" | "unknown";

export function genderOf(voice: Pick<SpeechSynthesisVoice, "name">): VoiceGender {
  const name = voice.name.toLowerCase();
  if (PREFERRED_FEMALE.some((f) => name.includes(f)) || FEMALE_HINTS.some((f) => name.includes(f))) return "female";
  if (MALE.some((m) => name.includes(m))) return "male";
  return "unknown";
}

// A synthetic formant voice (espeak and the like), as opposed to a natural
// or recorded one. Linux desktops expose espeak through speech-dispatcher,
// often under a plain name such as "French (France)".
export function isSynthetic(voice: Pick<SpeechSynthesisVoice, "name" | "voiceURI" | "localService">) {
  if (SYNTHETIC.test(voice.name) || SYNTHETIC.test(voice.voiceURI ?? "")) return true;
  return voice.localService && /^(french|français)(\s*\(.*\))?$/i.test(voice.name.trim());
}

function score(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  const gender = genderOf(voice);
  if (gender === "male") return -1;
  const rank = PREFERRED_FEMALE.findIndex((f) => name.includes(f));
  let s = rank !== -1 ? 100 - rank : gender === "female" ? 40 : 10;
  if (name.includes("natural") || name.includes("neural") || name.includes("online")) s += 50;
  if (voice.lang === "fr-FR") s += 5;
  if (!voice.localService) s += 2;
  if (isSynthetic(voice)) s -= 8;
  return s;
}

export function pickVoice(voices: SpeechSynthesisVoice[]) {
  const french = voices.filter((v) => v.lang?.toLowerCase().replace("_", "-").startsWith("fr"));
  const ranked = french.map((v) => ({ v, s: score(v) })).sort((a, b) => b.s - a.s);
  const best = ranked.find((r) => r.s >= 0) ?? ranked[0];
  return best?.v ?? null;
}

// Pitch and speed for a voice: natural voices as they are; a synthetic voice
// a little higher and slower, which makes espeak much easier to follow.
export function voiceSettings(voice: SpeechSynthesisVoice | null, userRate: number) {
  if (voice && isSynthetic(voice)) return { rate: Math.max(0.6, userRate * 0.88), pitch: genderOf(voice) === "female" ? 1.05 : 1.2 };
  return { rate: userRate, pitch: 1 };
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

// What Préférences shows: the voice this device will use for French.
export async function describeVoice() {
  if (!isSupported()) return null;
  const voice = pickVoice(await loadVoices());
  if (!voice) return { name: null, gender: "unknown" as VoiceGender, synthetic: false, online: false };
  return { name: voice.name, gender: genderOf(voice), synthetic: isSynthetic(voice), online: !voice.localService };
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

const PAUSE_MS = 220;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let session = 0;
// Chrome may garbage collect an utterance still being spoken, and its end
// event then never fires: the current one is kept here.
let current: SpeechSynthesisUtterance | null = null;
let audio: HTMLAudioElement | null = null;

// Speaks the text; resolves when finished or stopped. Starting a new reading
// stops the previous one.
export async function speak(text: string, onEnd?: () => void) {
  const synth = window.speechSynthesis;
  const mine = ++session;
  stopAudio();
  synth.cancel();
  const voice = pickVoice(await loadVoices());
  const { rate: r, pitch } = voiceSettings(voice, rate());
  // Desktop Chrome drops an utterance queued right after cancel().
  await wait(60);
  const parts = splitSentences(text);
  let index = 0;
  const next = () => {
    if (mine !== session) return;
    if (index >= parts.length) {
      current = null;
      return onEnd?.();
    }
    const u = new SpeechSynthesisUtterance(parts[index++]);
    u.lang = voice?.lang ?? "fr-FR";
    if (voice) u.voice = voice;
    u.rate = r;
    u.pitch = pitch;
    u.volume = 1;
    u.onend = () => setTimeout(next, PAUSE_MS);
    u.onerror = (e) => {
      if (mine !== session) return;
      // "interrupted" and "canceled" come from stop(); anything else skips
      // to the next sentence rather than ending the reading silently.
      if (e.error === "interrupted" || e.error === "canceled") return onEnd?.();
      setTimeout(next, PAUSE_MS);
    };
    current = u;
    synth.speak(u);
  };
  next();
}

// Level of the clips of the speech service: a compressor evens out loud and
// quiet syllables, a gain brings the whole up to the level of a phone
// speaker. Without Web Audio the element plays as is.
let audioContext: AudioContext | null = null;

// Called from the click that starts a reading: browsers only let an audio
// context run when it is created or resumed during a user gesture.
export function primeAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioContext ??= new Ctx();
    if (audioContext.state === "suspended") void audioContext.resume();
  } catch {
    audioContext = null;
  }
}

function route(element: HTMLAudioElement) {
  // A context that is not running would play silence: the element then
  // plays directly, at its own level.
  if (!audioContext || audioContext.state !== "running") return;
  try {
    const source = audioContext.createMediaElementSource(element);
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 20;
    compressor.ratio.value = 4;
    const gain = audioContext.createGain();
    gain.gain.value = 1.6;
    source.connect(compressor).connect(gain).connect(audioContext.destination);
  } catch {
    // Played directly.
  }
}

// Plays the clips in order, with the same short pause as between French
// sentences. Resolves true when all played, false when stopped or failed.
export async function playClips(urls: string[], onEnd?: (ok: boolean) => void) {
  const mine = ++session;
  if (isSupported()) window.speechSynthesis.cancel();
  stopAudio();
  for (const url of urls) {
    if (mine !== session) return onEnd?.(false);
    const ok = await new Promise<boolean>((resolve) => {
      const el = new Audio(url);
      el.preload = "auto";
      el.volume = 1;
      audio = el;
      route(el);
      el.onended = () => resolve(true);
      el.onerror = () => resolve(false);
      el.play().catch(() => resolve(false));
    });
    if (!ok) return onEnd?.(false);
    await wait(PAUSE_MS);
  }
  if (mine === session) onEnd?.(true);
}

function stopAudio() {
  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }
}

export function stop() {
  session++;
  if (current) current.onend = null;
  current = null;
  stopAudio();
  if (isSupported()) window.speechSynthesis.cancel();
}

// A new reading started elsewhere (another ReadAloud button) invalidates
// the one in progress.
export function currentSession() {
  return session;
}
