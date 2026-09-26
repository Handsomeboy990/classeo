// Kora, the voice of Classéo.
//
// French: Piper on the server, voice Siwis, the same female voice on every
// device (see /api/voix). The text is cut into short parts; each part is
// asked for while the previous one plays, and the server keeps every clip,
// so a text already heard costs no new synthesis.
//
// When the server voice is not configured or fails, or the device is
// offline, the browser reads with its own speech synthesis, with a
// deliberate choice of voice: a French female voice, preferring the natural
// (neural) voices shipped by Edge, Chrome, macOS, iOS and Android, and never
// a male voice when a female one exists. On a desktop without such a voice
// (Chromium or Firefox on Linux) the browser only offers the synthetic
// espeak voice, male and harsh: Kora then raises its pitch a little and
// slows it down, so that it stays understandable. Text is spoken sentence
// by sentence with a short pause in between: long utterances get cut off
// after about fifteen seconds in Chrome, and short ones sound more natural
// and can be stopped at once.
//
// Fon, Yoruba and Hausa: clips synthesised by the server (see
// /api/langues/voix). Every clip, French or not, plays at a normalised
// level.
//
// Speed: the setting of Préférences is the utterance rate of the browser
// voice. Server clips are made once at a fixed pace (PIPER_PACE, the pace
// of "Normale") and played faster or slower with playbackRate, pitch
// preserved. Passing the setting to Piper as its length scale instead would
// make three clips, three syntheses and three cache entries of the same
// text; playbackRate costs nothing and applies to the clips already cached.

import { frenchParts } from "./speech-text";

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

// Speed chosen in Préférences, stored as "classeo:voice-rate". "Normale"
// used to be 0.95, found too fast: a value saved then now reads as the new
// normal pace.
export const NORMAL_RATE = "0.85";

export function storedRate(raw: string | null) {
  return !raw || raw === "0.95" ? NORMAL_RATE : raw;
}

function rate() {
  try {
    const r = Number(storedRate(localStorage.getItem("classeo:voice-rate")));
    return r > 0 ? r : Number(NORMAL_RATE);
  } catch {
    return Number(NORMAL_RATE);
  }
}

// Playback speed of a server clip for the chosen rate: clips are made at the
// normal pace, the setting scales it.
export function playbackRateFor(userRate: number) {
  return Math.min(1.5, Math.max(0.6, userRate / Number(NORMAL_RATE)));
}

// The French voice of the server ("Siwis"), asked once per page; null when
// the server has none (voice not configured or failing) or cannot be
// reached.
let serverVoice: Promise<string | null> | null = null;
// After a failure the browser voice is used for a minute without asking.
let serverDownUntil = 0;

function online() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function serverVoiceName(): Promise<string | null> {
  if (!online() || Date.now() < serverDownUntil) return Promise.resolve(null);
  serverVoice ??= fetch("/api/voix", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ voice?: unknown }>) : null))
    .then((b) => (typeof b?.voice === "string" ? b.voice : null))
    .catch(() => {
      // Offline or unreachable: asked again next time.
      serverVoice = null;
      return null;
    });
  return serverVoice;
}

// What Préférences shows: the French voice of the server, and the one of
// this device, used when the server voice is not available.
export async function describeVoice() {
  const [server, device] = await Promise.all([serverVoiceName(), describeDeviceVoice()]);
  return { server, device };
}

async function describeDeviceVoice() {
  if (!isSupported()) return null;
  const voice = pickVoice(await loadVoices());
  if (!voice) return { name: null, gender: "unknown" as VoiceGender, synthetic: false, online: false };
  return { name: voice.name, gender: genderOf(voice), synthetic: isSynthetic(voice), online: !voice.localService };
}

const PAUSE_MS = 220;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "done": read to the end. "stopped": stopped, or replaced by another
// reading. "failed": cut off by an error. "unavailable": no voice at all.
export type Outcome = "done" | "stopped" | "failed" | "unavailable";

let session = 0;
// Chrome may garbage collect an utterance still being spoken, and its end
// event then never fires: the current one is kept here.
let current: SpeechSynthesisUtterance | null = null;

// Speaks a French text: the server voice first, the browser voice for what
// is left if the server cannot. Resolves when finished or stopped. Starting
// a new reading stops the previous one.
export async function speak(text: string, onEnd?: (outcome: Outcome) => void, onStart?: () => void) {
  const mine = ++session;
  stopAudio();
  if (isSupported()) window.speechSynthesis.cancel();
  const parts = frenchParts(text);
  if (!parts.length) return onEnd?.("done");
  const played = await speakWithServer(text, parts.length, mine, onStart);
  if (mine !== session) return onEnd?.("stopped");
  if (played === parts.length) return onEnd?.("done");
  if (!isSupported()) return onEnd?.(played ? "failed" : "unavailable");
  await speakWithBrowser(parts.slice(played).join(" "), mine, onEnd, onStart);
}

// Asks the server for the clip of one part. Null when it cannot give one;
// when the voice is down (503) or the server unreachable, the browser voice
// takes over for a minute. A refusal for this text only (signed out on a
// private text, too many requests) does not.
async function askPart(text: string, part: number): Promise<string | null> {
  try {
    const res = await fetch("/api/voix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, part }),
      // The first clip of a new server instance can take a while.
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => ({}))) as { clip?: unknown };
    if (res.ok && typeof body.clip === "string") return body.clip;
    if (res.status === 503) serverDownUntil = Date.now() + 60_000;
  } catch {
    serverDownUntil = Date.now() + 60_000;
  }
  return null;
}

// Plays the parts from the server in order; returns how many played.
async function speakWithServer(text: string, count: number, mine: number, onStart?: () => void) {
  if (!(await serverVoiceName()) || mine !== session) return 0;
  const speed = playbackRateFor(rate());
  let next = askPart(text, 0);
  for (let i = 0; i < count; i++) {
    const url = await next;
    if (mine !== session || !url) return i;
    // The next part is prepared while this one plays.
    next = i + 1 < count ? askPart(text, i + 1) : Promise.resolve(null);
    if (i === 0) onStart?.();
    if ((await playOne(url, speed)) !== "done" || mine !== session) return i;
    if (i + 1 < count) await wait(PAUSE_MS);
  }
  return count;
}

async function speakWithBrowser(text: string, mine: number, onEnd?: (outcome: Outcome) => void, onStart?: () => void) {
  const synth = window.speechSynthesis;
  const voice = pickVoice(await loadVoices());
  const { rate: r, pitch } = voiceSettings(voice, rate());
  // Desktop Chrome drops an utterance queued right after cancel().
  await wait(60);
  const parts = splitSentences(text);
  let index = 0;
  if (mine === session) onStart?.();
  const next = () => {
    if (mine !== session) return;
    if (index >= parts.length) {
      current = null;
      return onEnd?.("done");
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
      if (e.error === "interrupted" || e.error === "canceled") return onEnd?.("stopped");
      setTimeout(next, PAUSE_MS);
    };
    current = u;
    synth.speak(u);
  };
  next();
}

// Level of the clips of the speech services: a compressor evens out loud
// and quiet syllables, a gain brings the whole up to the level of a phone
// speaker. Without Web Audio the element plays as is.
let audioContext: AudioContext | null = null;

// One element plays every clip. iOS lets an element play without a tap
// only once it played during one: primeAudio() starts it on a short
// silence from the click that begins a reading.
let player: HTMLAudioElement | null = null;
let routed = false;
// Resolves the clip playing when it is stopped.
let settle: ((outcome: Outcome) => void) | null = null;
const SILENCE =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

function element() {
  player ??= new Audio();
  player.preload = "auto";
  return player;
}

// Called from the click that starts a reading: browsers only let an audio
// context run, and an audio element play, when started during a user
// gesture.
export function primeAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioContext ??= new Ctx();
      if (audioContext.state === "suspended") void audioContext.resume();
    }
  } catch {
    audioContext = null;
  }
  if (typeof Audio === "undefined") return;
  const el = element();
  if (el.paused) {
    el.src = SILENCE;
    el.play().catch(() => undefined);
  }
}

function route(el: HTMLAudioElement) {
  // A context that is not running would play silence: the element then
  // plays directly, at its own level. An element is connected once.
  if (routed || !audioContext || audioContext.state !== "running") return;
  try {
    const source = audioContext.createMediaElementSource(el);
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 20;
    compressor.ratio.value = 4;
    const gain = audioContext.createGain();
    gain.gain.value = 1.6;
    source.connect(compressor).connect(gain).connect(audioContext.destination);
    routed = true;
  } catch {
    // Played directly.
  }
}

function playOne(url: string, speed: number) {
  return new Promise<Outcome>((resolve) => {
    const el = element();
    route(el);
    settle = resolve;
    el.onended = () => resolve("done");
    el.onerror = () => resolve("failed");
    // Loading a source resets playbackRate to defaultPlaybackRate.
    el.defaultPlaybackRate = speed;
    el.preservesPitch = true;
    (el as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    el.volume = 1;
    el.src = url;
    el.playbackRate = speed;
    el.play().catch(() => resolve("failed"));
  });
}

// Plays the clips of a local language in order, with the same short pause
// as between French sentences, at the speed chosen in Préférences.
export async function playClips(urls: string[], onEnd?: (outcome: Outcome) => void) {
  const mine = ++session;
  if (isSupported()) window.speechSynthesis.cancel();
  stopAudio();
  const speed = playbackRateFor(rate());
  for (const url of urls) {
    if (mine !== session) return onEnd?.("stopped");
    const outcome = await playOne(url, speed);
    if (mine !== session) return onEnd?.("stopped");
    if (outcome !== "done") return onEnd?.(outcome);
    await wait(PAUSE_MS);
  }
  if (mine === session) onEnd?.("done");
}

function stopAudio() {
  settle?.("stopped");
  settle = null;
  // The silence started by primeAudio() is left to end on its own.
  if (player && !player.paused && player.src !== SILENCE) player.pause();
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
