"use client";

import { originals } from "./client";
import { isCandidate, lookupText, normalise } from "./text";

// The translation layer works on the text nodes of the main region, after
// React has rendered them: nothing in the pages has to change. Skipped:
// fields, code, anything marked data-no-translate or translate="no" (user
// content shown in its own block, translated on request).
const SKIP = "script, style, noscript, textarea, input, select, option, code, pre, svg, [data-no-translate], [translate=no], [contenteditable=true]";

export function acceptsNode(node: Text) {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return false;
  return isCandidate(normalise(frenchOf(node)));
}

function frenchOf(node: Text) {
  return originals.get(node) ?? node.textContent ?? "";
}

export function textNodes(root: Node): Text[] {
  if (root.nodeType === Node.TEXT_NODE) return acceptsNode(root as Text) ? [root as Text] : [];
  if (!(root instanceof Element) || root.closest(SKIP)) return [];
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (acceptsNode(n as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

export function sourceKey(node: Text) {
  return normalise(frenchOf(node));
}

// What the layer wrote in each node: a node whose content differs has been
// changed by React since, and its new content is the new French source.
const written = new Map<Text, string>();

export function wasWrittenByLayer(node: Text) {
  return written.get(node) === node.textContent;
}

// The node now holds new French text (React re-rendered it).
export function forget(node: Text) {
  written.delete(node);
  originals.delete(node);
}

// Replaces the node's text by its translation, keeping the surrounding
// spaces. Returns false when the map has no translation for it.
export function translateNode(node: Text, map: Map<string, string>) {
  const source = frenchOf(node);
  const t = lookupText(normalise(source), map);
  if (!t) return false;
  const lead = source.match(/^\s*/)?.[0] ?? "";
  const trail = source.match(/\s*$/)?.[0] ?? "";
  const next = `${lead}${t}${trail}`;
  originals.set(node, source);
  if (node.textContent !== next) node.textContent = next;
  written.set(node, next);
  return true;
}

// Puts every translated node back in French.
export function restoreAll() {
  for (const [node, value] of written) {
    const source = originals.get(node);
    if (source !== undefined && node.isConnected && node.textContent === value) node.textContent = source;
    originals.delete(node);
  }
  written.clear();
}

// Nodes removed from the page are dropped from the bookkeeping.
export function prune() {
  for (const node of written.keys()) if (!node.isConnected) written.delete(node);
}
