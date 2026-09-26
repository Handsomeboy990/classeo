import { originals } from "./client";
import { dateLabel } from "./date-words";
import { isCandidate, isTranslatable, lookupKeys, normalise } from "./text";

// The translation layer works on the rendered document, after React: nothing
// in the pages has to change. It covers the whole application shell (top
// bar, menus, tab bar, the dialogs, sheets, popovers and toasts rendered in
// portals), the text a reader sees and the attributes a reader hears or sees
// in a tooltip. Skipped: fields, code, anything marked data-no-translate or
// translate="no" (the language switcher, user content shown in its own
// block and translated on request).
//
// Written against the few DOM members it needs (nodeType, childNodes,
// tagName, attributes), so the rules run in unit tests without a browser.

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

export const ATTRIBUTES = ["aria-label", "aria-description", "aria-valuetext", "title", "placeholder", "alt"] as const;
export type TranslatedAttribute = (typeof ATTRIBUTES)[number];

// A textarea holds what the person typed: only its placeholder is
// translated.
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "CODE", "PRE", "KBD", "SAMP"]);

// Phrasing elements a sentence may run through: "Vous avez <strong>trois
// </strong> messages". A link or a line break ends the sentence.
const INLINE = new Set(["ABBR", "B", "BDI", "BDO", "CITE", "DATA", "DFN", "EM", "I", "MARK", "Q", "S", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME", "U", "VAR"]);

function skipsItself(el: Element) {
  return SKIP_TAGS.has(el.tagName) || el.hasAttribute("data-no-translate") || el.getAttribute("translate") === "no" || el.getAttribute("contenteditable") === "true";
}

// Whether the element or one of its ancestors is left alone.
export function isSkipped(el: Element | null) {
  for (let e = el; e; e = e.parentElement) if (skipsItself(e)) return true;
  return false;
}

// Whether an element flows inside the line (display: inline). Flex and grid
// items are blockified by the browser, so spans laid out as columns or
// badges never glue into one sentence. Injected in tests.
export type InlineCheck = (el: Element) => boolean;
export const displayedInline: InlineCheck = (el) => typeof getComputedStyle === "function" && getComputedStyle(el).display === "inline";

// Whether React already owns an element: it keeps its fiber on every node it
// rendered or hydrated. The server HTML of a Suspense boundary that is not
// hydrated yet has none, and rewriting its text would make the hydration
// fail (React error 418) and the section render again. Such a region is left
// for a later pass. Injected in tests.
export type ReadyCheck = (el: Element) => boolean;
let fiberKey: string | null = null;
export const ownedByReact: ReadyCheck = (el) => {
  if (!fiberKey && typeof document !== "undefined") fiberKey = Object.keys(document.documentElement).find((k) => k.startsWith("__reactFiber$")) ?? null;
  return !fiberKey || fiberKey in el;
};

export type CollectOptions = { inline?: InlineCheck; ready?: ReadyCheck; onLater?: (el: Element) => void };

// ---------------------------------------------------------------------------
// Units: what is translated as one string.

export type Unit =
  | { kind: "text"; node: Text }
  // A block whose text is cut by inline elements, translated as one
  // sentence: fragments lose their meaning.
  | { kind: "sentence"; block: Element; nodes: Text[] }
  | { kind: "attribute"; el: Element; name: TranslatedAttribute };

// What the layer wrote, to tell its own changes from React's.
const writtenText = new Map<Text, string>();
const writtenAttr = new Map<Element, Map<string, { source: string; value: string }>>();
// Blocks currently showing a whole sentence translation.
const sentences = new Map<Element, Text[]>();

export function frenchOf(node: Text) {
  return originals.get(node) ?? node.nodeValue ?? "";
}

export function frenchAttribute(el: Element, name: string) {
  const w = writtenAttr.get(el)?.get(name);
  const current = el.getAttribute(name) ?? "";
  return w && w.value === current ? w.source : current;
}

export function wasWrittenByLayer(node: Text) {
  return writtenText.has(node) && writtenText.get(node) === node.nodeValue;
}

export function attributeWrittenByLayer(el: Element, name: string) {
  const w = writtenAttr.get(el)?.get(name);
  return !!w && w.value === el.getAttribute(name);
}

// The node now holds new French text (React re-rendered it).
export function forget(node: Text) {
  writtenText.delete(node);
  originals.delete(node);
}

function write(node: Text, value: string) {
  if (!originals.has(node)) originals.set(node, node.nodeValue ?? "");
  if (node.nodeValue !== value) node.nodeValue = value;
  writtenText.set(node, value);
}

function restoreNode(node: Text) {
  const source = originals.get(node);
  if (source !== undefined && writtenText.get(node) === node.nodeValue) node.nodeValue = source;
  writtenText.delete(node);
  originals.delete(node);
}

// The text nodes of a block when it reads as one sentence split by inline
// elements; null otherwise (a single run of text, a link, a line break, a
// nested block, hidden or screen reader only words that the sentence would
// make visible).
export function sentenceNodes(block: Element, inline: InlineCheck = displayedInline): Text[] | null {
  if (INLINE.has(block.tagName) || skipsItself(block)) return null;
  const nodes: Text[] = [];
  let pieces = 0;
  let elements = 0;
  let ok = true;
  const walk = (parent: Node) => {
    for (const child of Array.from(parent.childNodes)) {
      if (!ok) return;
      if (child.nodeType === TEXT_NODE) {
        nodes.push(child as Text);
        if (frenchOf(child as Text).trim()) pieces++;
      } else if (child.nodeType === ELEMENT_NODE) {
        const el = child as Element;
        // Icons carry no words.
        if (el.tagName.toLowerCase() === "svg" || el.tagName === "IMG") {
          if ((el.textContent ?? "").trim()) ok = false;
          continue;
        }
        if (!INLINE.has(el.tagName) || skipsItself(el) || el.hasAttribute("hidden") || /\bsr-only\b/.test(el.getAttribute("class") ?? "") || !inline(el)) {
          ok = false;
          return;
        }
        elements++;
        walk(el);
      }
    }
  };
  walk(block);
  if (!ok || elements === 0 || pieces < 2) return null;
  const text = normalise(nodes.map(frenchOf).join(""));
  return isTranslatable(text) ? nodes : null;
}

// The block a text node belongs to: its nearest ancestor that is not an
// inline element.
function blockOf(node: Text) {
  let el = node.parentElement;
  while (el && INLINE.has(el.tagName)) el = el.parentElement;
  return el;
}

// Every unit under root (an element or a text node), in document order.
// Sentence blocks are resolved from the node upwards, so a change deep in a
// sentence brings back the whole sentence.
export function collect(root: Node, { inline = displayedInline, ready = ownedByReact, onLater }: CollectOptions = {}): Unit[] {
  const units: Unit[] = [];
  // Comments (React's Suspense markers) and other nodes hold nothing to read.
  if (root.nodeType !== TEXT_NODE && root.nodeType !== ELEMENT_NODE) return units;
  const start = root.nodeType === TEXT_NODE ? root.parentElement : (root as Element);
  if (!start || isSkipped(start)) return units;
  if (!ready(start)) {
    onLater?.(start);
    return units;
  }
  const checked = new Map<Element, Text[] | null>();
  const text = (node: Text) => {
    const block = blockOf(node);
    if (block && !isSkipped(block)) {
      if (!checked.has(block)) {
        const nodes = sentenceNodes(block, inline);
        checked.set(block, nodes);
        if (nodes) units.push({ kind: "sentence", block, nodes });
      }
      if (checked.get(block)) return;
    }
    if (isTranslatable(normalise(frenchOf(node)))) units.push({ kind: "text", node });
  };
  const visit = (node: Node) => {
    if (node.nodeType === TEXT_NODE) return text(node as Text);
    if (node.nodeType !== ELEMENT_NODE) return;
    const el = node as Element;
    const field = el.tagName === "TEXTAREA";
    if (skipsItself(el) && !field) return;
    if (!ready(el)) {
      onLater?.(el);
      return;
    }
    for (const name of ATTRIBUTES) {
      if (el.hasAttribute(name) && isCandidate(normalise(frenchAttribute(el, name)))) units.push({ kind: "attribute", el, name });
    }
    if (field) return;
    for (const child of Array.from(el.childNodes)) visit(child);
  };
  visit(root);
  return units;
}

// The French source of a unit, normalised: the key of the cache.
export function sourceOf(unit: Unit) {
  if (unit.kind === "text") return normalise(frenchOf(unit.node));
  if (unit.kind === "attribute") return normalise(frenchAttribute(unit.el, unit.name));
  return normalise(unit.nodes.map(frenchOf).join(""));
}

// The cache entries a unit may use. A sentence asks for itself and, as a
// fallback until it is known, for its fragments.
export function keysOf(unit: Unit, names: RegExp | null = null): string[] {
  const keys = (text: string) => lookupKeys(text, dateLabel, names);
  if (unit.kind !== "sentence") return keys(sourceOf(unit));
  const fragments = unit.nodes.map((n) => normalise(frenchOf(n))).filter(isCandidate);
  return [...keys(sourceOf(unit)), ...fragments.flatMap(keys)];
}

export type Lookup = (source: string) => string | undefined;

function translateText(node: Text, lookup: Lookup) {
  const source = frenchOf(node);
  const key = normalise(source);
  const t = isTranslatable(key) ? lookup(key) : undefined;
  if (!t) {
    // Back to French: the node may show a sentence that no longer applies.
    if (writtenText.has(node)) restoreNode(node);
    return !isTranslatable(key);
  }
  const lead = source.match(/^\s*/)?.[0] ?? "";
  const trail = source.match(/\s*$/)?.[0] ?? "";
  write(node, `${lead}${t}${trail}`);
  return true;
}

// Writes the translation of a unit. Returns false when the cache has
// nothing for it (the unit then shows French). A sentence without a
// translation of its own falls back to its fragments.
export function applyUnit(unit: Unit, lookup: Lookup): boolean {
  if (unit.kind === "text") return translateText(unit.node, lookup);
  if (unit.kind === "attribute") {
    const source = frenchAttribute(unit.el, unit.name);
    const t = lookup(normalise(source));
    const slots = writtenAttr.get(unit.el) ?? new Map<string, { source: string; value: string }>();
    if (!t) {
      if (slots.has(unit.name)) {
        unit.el.setAttribute(unit.name, source);
        slots.delete(unit.name);
      }
      return false;
    }
    slots.set(unit.name, { source, value: t });
    writtenAttr.set(unit.el, slots);
    if (unit.el.getAttribute(unit.name) !== t) unit.el.setAttribute(unit.name, t);
    return true;
  }
  const whole = lookup(sourceOf(unit));
  if (whole) {
    // The sentence goes in the first run of text directly inside the block
    // (so it takes the block's style, not the emphasis of a word), the
    // other runs are emptied.
    const target = unit.nodes.find((n) => n.parentNode === unit.block && frenchOf(n).trim()) ?? unit.nodes.find((n) => frenchOf(n).trim())!;
    for (const n of unit.nodes) write(n, n === target ? whole : "");
    sentences.set(unit.block, unit.nodes);
    return true;
  }
  sentences.delete(unit.block);
  let all = true;
  for (const n of unit.nodes) all = translateText(n, lookup) && all;
  return all;
}

// The sentence block a changed node belongs to, when that block shows a
// sentence translation: React changed one of its runs, the whole sentence
// is taken again from its French runs.
export function sentenceAround(node: Node): Element | null {
  for (let el = node.nodeType === TEXT_NODE ? node.parentElement : (node as Element); el; el = el.parentElement) {
    if (sentences.has(el)) return el;
    if (!INLINE.has(el.tagName)) return null;
  }
  return null;
}

// Puts everything back in French.
export function restoreAll() {
  for (const node of [...writtenText.keys()]) if (node.isConnected) restoreNode(node);
  writtenText.clear();
  for (const [el, slots] of writtenAttr) {
    for (const [name, w] of slots) if (el.isConnected && el.getAttribute(name) === w.value) el.setAttribute(name, w.source);
  }
  writtenAttr.clear();
  sentences.clear();
}

// Nodes removed from the page are dropped from the bookkeeping.
export function prune() {
  for (const node of writtenText.keys()) if (!node.isConnected) writtenText.delete(node);
  for (const el of writtenAttr.keys()) if (!el.isConnected) writtenAttr.delete(el);
  for (const el of sentences.keys()) if (!el.isConnected) sentences.delete(el);
}

// What a batch of mutation records asks to translate again: the roots to
// collect from. Changes the layer made itself are ignored; a text React
// rewrote becomes the new French source; a change inside a translated
// sentence brings back the whole block.
export type Change = { type: string; target: Node; addedNodes: ArrayLike<Node>; attributeName?: string | null };

export function changedRoots(records: readonly Change[]): Node[] {
  const roots = new Set<Node>();
  const add = (n: Node) => {
    if (n.nodeType === TEXT_NODE || n.nodeType === ELEMENT_NODE) roots.add(sentenceAround(n) ?? n);
  };
  for (const r of records) {
    if (r.type === "characterData" && r.target.nodeType === TEXT_NODE) {
      const t = r.target as Text;
      if (wasWrittenByLayer(t)) continue;
      forget(t);
      add(t);
    } else if (r.type === "attributes" && r.attributeName && r.target.nodeType === ELEMENT_NODE) {
      const el = r.target as Element;
      if (attributeWrittenByLayer(el, r.attributeName)) continue;
      writtenAttr.get(el)?.delete(r.attributeName);
      roots.add(el);
    } else if (r.type === "childList") {
      for (const n of Array.from(r.addedNodes)) add(n);
      // A run removed from a translated sentence changes the sentence.
      const around = sentenceAround(r.target);
      if (around) roots.add(around);
    }
  }
  // A root inside another root is collected with it.
  return [...roots].filter((n) => {
    for (let p = n.parentNode; p; p = p.parentNode) if (roots.has(p)) return false;
    return true;
  });
}
