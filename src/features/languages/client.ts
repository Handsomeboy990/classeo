"use client";

import { useSyncExternalStore } from "react";

import { isTargetLanguage, voiceOf, type LanguageCode, type TargetLanguage } from "./languages";

// Browser side state of the local languages: the language chosen by the
// signed in user (remembered on this device, per account), whether the page
// shows the French original, and what the server allows. The server decides
// access (translation:view, options); this only mirrors it for the UI.

export type LanguageState = {
  allowed: boolean;
  userId: string | null;
  lang: LanguageCode;
  // Last local language chosen, offered by "Traduire en ..." while the
  // interface is in French.
  lastLocal: TargetLanguage;
  showOriginal: boolean;
  voices: string[];
  languages: string[];
};

const INITIAL: LanguageState = { allowed: false, userId: null, lang: "fr", lastLocal: "fon", showOriginal: false, voices: [], languages: [] };

let state: LanguageState = INITIAL;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

const storageKey = (userId: string) => `classeo:lang:${userId}`;

function remembered(userId: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "null") as { lang?: string; lastLocal?: string } | null;
    return raw ?? {};
  } catch {
    return {};
  }
}

function save() {
  if (!state.userId) return;
  try {
    localStorage.setItem(storageKey(state.userId), JSON.stringify({ lang: state.lang, lastLocal: state.lastLocal }));
  } catch {
    // Private mode: the choice holds for this visit only.
  }
}

// Called once by the layer mounted in the private space layout.
export function initLanguages(input: { allowed: boolean; userId: string; voices: string[]; languages: string[] }) {
  const saved = input.allowed ? remembered(input.userId) : {};
  const ok = (v: unknown): v is TargetLanguage => isTargetLanguage(v) && input.languages.includes(v);
  state = {
    ...INITIAL,
    ...input,
    lang: ok(saved.lang) ? saved.lang : "fr",
    lastLocal: ok(saved.lastLocal) ? saved.lastLocal : ok(input.languages[0]) ? input.languages[0] : "fon",
  };
  emit();
}

export function setLanguage(lang: LanguageCode) {
  if (!state.allowed) return;
  state = { ...state, lang, showOriginal: false, lastLocal: lang === "fr" ? state.lastLocal : lang };
  save();
  emit();
}

export function setShowOriginal(showOriginal: boolean) {
  state = { ...state, showOriginal };
  emit();
}

export function getLanguageState() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguageState() {
  return useSyncExternalStore(subscribe, getLanguageState, () => INITIAL);
}

// The language the voice should speak for this user now: a local language
// with a voice, or null for French.
export function speechLanguage(): { lang: TargetLanguage; voice: string } | null {
  const s = state;
  if (!s.allowed || s.lang === "fr" || s.showOriginal) return null;
  const voice = voiceOf(s.lang, s.voices);
  return voice ? { lang: s.lang, voice } : null;
}

// Text nodes rewritten by the translation layer keep their French original
// here, so the voice and "Voir l'original" always work from the source.
export const originals = new WeakMap<Text, string>();

export function frenchTextOf(node: Text) {
  return originals.get(node) ?? node.textContent ?? "";
}

// The French text of an element, for code that copies a text of the page
// elsewhere (the heading shown in the phone's top bar): the copy is then
// translated like any other text, never taken for French.
export function frenchTextContent(el: Element) {
  let out = "";
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out += frenchTextOf(n as Text);
  return out;
}
