import { afterEach, describe, expect, it } from "vitest";

import { frenchTextOf } from "./client";
import { translateDate } from "./date-words";
import { applyUnit, changedRoots, collect, frenchAttribute, keysOf, restoreAll, sourceOf, type Change, type Unit } from "./dom";
import { lookupText } from "./text";

// A tiny document: just the members the layer reads (nodeType, childNodes,
// tagName, attributes, nodeValue), enough to run its rules without a
// browser.
class FakeText {
  readonly nodeType = 3;
  parentNode: FakeElement | null = null;
  constructor(public nodeValue: string) {}
  get parentElement() {
    return this.parentNode;
  }
  get textContent() {
    return this.nodeValue;
  }
  get isConnected(): boolean {
    return !!this.parentNode?.isConnected;
  }
}

class FakeElement {
  readonly nodeType = 1;
  parentNode: FakeElement | null = null;
  childNodes: (FakeElement | FakeText)[] = [];
  root = false;
  private attrs = new Map<string, string>();
  constructor(
    public tagName: string,
    attrs: Record<string, string> = {},
  ) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
  }
  get parentElement() {
    return this.parentNode;
  }
  get isConnected(): boolean {
    return this.root || !!this.parentNode?.isConnected;
  }
  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join("");
  }
  hasAttribute(name: string) {
    return this.attrs.has(name);
  }
  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }
}

type Child = FakeElement | FakeText | string;
function h(tag: string, attrs: Record<string, string> | null, ...children: Child[]) {
  const el = new FakeElement(tag.toLowerCase() === "svg" ? "svg" : tag.toUpperCase(), attrs ?? {});
  for (const c of children) {
    const node = typeof c === "string" ? new FakeText(c) : c;
    node.parentNode = el;
    el.childNodes.push(node);
  }
  return el;
}
function mount(el: FakeElement) {
  const body = h("body", null, el);
  body.root = true;
  return body;
}
const asNode = (n: FakeElement | FakeText) => n as unknown as Node;
const inline = () => true;
const units = (root: FakeElement) => collect(asNode(root), { inline, ready: () => true });
const lookupIn = (entries: [string, string][]) => {
  const map = new Map(entries);
  return (s: string) => lookupText(s, map, (t) => translateDate(t, "fon"));
};
const text = (el: FakeElement) => el.textContent.replace(/\s+/g, " ").trim();

afterEach(() => restoreAll());

describe("sentence grouping", () => {
  it("translates a sentence cut by inline elements as a whole", () => {
    const strong = h("strong", null, "trois");
    const p = h("p", null, "Vous avez ", strong, " messages non lus.");
    mount(p);
    const found = units(p);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe("sentence");
    expect(sourceOf(found[0]!)).toBe("Vous avez trois messages non lus.");
    expect(applyUnit(found[0]!, lookupIn([["Vous avez trois messages non lus.", "A ɖó wɛn atɔ̀n"]]))).toBe(true);
    expect(text(p)).toBe("A ɖó wɛn atɔ̀n");
    // The sentence sits in the block's own text, the emphasis is emptied.
    expect(strong.textContent).toBe("");
    // The voice still reads the French source of every run.
    const runs = [p.childNodes[0], strong.childNodes[0], p.childNodes[2]] as FakeText[];
    expect(runs.map((n) => frenchTextOf(n as unknown as Text)).join("")).toBe("Vous avez trois messages non lus.");
    restoreAll();
    expect(text(p)).toBe("Vous avez trois messages non lus.");
  });

  it("falls back to the fragments until the sentence is known, and asks for both", () => {
    const p = h("p", null, "Consultez ", h("em", null, "le bulletin"), " du trimestre.");
    mount(p);
    const [unit] = units(p);
    expect(keysOf(unit!)).toEqual(["Consultez le bulletin du trimestre.", "Consultez", "le bulletin", "du trimestre."]);
    expect(applyUnit(unit!, lookupIn([["le bulletin", "wema"]]))).toBe(false);
    expect(text(p)).toBe("Consultez wema du trimestre.");
  });

  it("never glues a link, a hidden word, a block or a laid out span into a sentence", () => {
    const cases = [
      h("p", null, "Lire ", h("a", { href: "/aide" }, "le guide"), " avant."),
      h("p", null, "Moyenne ", h("span", { class: "sr-only" }, "sur vingt"), " du trimestre"),
      h("div", null, "Absences ", h("p", null, "ce mois")),
    ];
    for (const block of cases) {
      mount(block);
      expect(units(block).every((u) => u.kind !== "sentence")).toBe(true);
    }
    const laidOut = h("div", null, h("span", null, "Statut"), h("span", null, "Payé"));
    mount(laidOut);
    expect(collect(asNode(laidOut), { inline: () => false, ready: () => true }).map((u) => u.kind)).toEqual(["text", "text"]);
  });

  it("keeps names and figures of a fragment fallback as they are", () => {
    const p = h("p", null, "Bonjour ", h("strong", null, "Afiavi"));
    mount(p);
    const [unit] = units(p);
    applyUnit(unit!, lookupIn([["Bonjour", "Kúdó"]]));
    expect(text(p)).toBe("Kúdó Afiavi");
  });
});

describe("attributes and skipped regions", () => {
  it("translates the attributes a reader hears or sees, and restores them", () => {
    const button = h("button", { "aria-label": "Fermer", title: "Fermer la fenêtre", "data-x": "Fermer" });
    const input = h("textarea", { placeholder: "Rechercher une rubrique" }, "Texte saisi");
    const root = h("div", null, button, input);
    mount(root);
    const found = units(root);
    expect(found.map((u) => (u.kind === "attribute" ? u.name : u.kind))).toEqual(["aria-label", "title", "placeholder"]);
    const lookup = lookupIn([
      ["Fermer", "Sú"],
      ["Rechercher une rubrique", "Ba nǔ"],
    ]);
    found.forEach((u) => applyUnit(u, lookup));
    expect(button.getAttribute("aria-label")).toBe("Sú");
    expect(button.getAttribute("title")).toBe("Fermer la fenêtre");
    expect(input.getAttribute("placeholder")).toBe("Ba nǔ");
    expect(frenchAttribute(button as unknown as Element, "aria-label")).toBe("Fermer");
    restoreAll();
    expect(button.getAttribute("aria-label")).toBe("Fermer");
    expect(input.getAttribute("placeholder")).toBe("Rechercher une rubrique");
  });

  it("leaves alone what is marked data-no-translate or translate=no, and fields", () => {
    const root = h(
      "div",
      null,
      h("section", { "data-no-translate": "" }, h("p", null, "Texte de l'annonce")),
      h("p", { translate: "no" }, "Code élève"),
      h("textarea", null, "Mon message"),
      h("p", null, "Mes enfants"),
    );
    mount(root);
    expect(units(root).map(sourceOf)).toEqual(["Mes enfants"]);
  });

  it("leaves server HTML React has not hydrated yet for a later pass", () => {
    const pending = h("section", { "data-pending": "" }, h("p", null, "Mes enfants"));
    const root = h("div", null, h("p", null, "Notifications"), pending);
    mount(root);
    const later: unknown[] = [];
    const found = collect(asNode(root), { inline, ready: (el) => !el.hasAttribute("data-pending"), onLater: (el) => later.push(el) });
    expect(found.map(sourceOf)).toEqual(["Notifications"]);
    expect(later).toEqual([pending]);
  });

  it("translates the options of a select and the labels of a chart", () => {
    const root = h("div", null, h("select", null, h("option", null, "Tous les enfants")), h("svg", null, h("text", null, "Moyenne de la classe")));
    mount(root);
    expect(units(root).map(sourceOf)).toEqual(["Tous les enfants", "Moyenne de la classe"]);
  });
});

describe("mutation handling", () => {
  const record = (r: { type?: string; target: FakeElement | FakeText; addedNodes?: Node[]; attributeName?: string }): Change => ({
    type: r.type ?? "childList",
    addedNodes: r.addedNodes ?? [],
    attributeName: r.attributeName,
    target: asNode(r.target),
  });

  it("ignores the layer's own writes and takes React's rewrites as new French", () => {
    const p = h("p", null, "Mes enfants");
    mount(p);
    const node = p.childNodes[0] as FakeText;
    const lookup = lookupIn([
      ["Mes enfants", "Vǐ ce lɛ"],
      ["Notifications", "Wěn lɛ"],
    ]);
    units(p).forEach((u) => applyUnit(u, lookup));
    expect(changedRoots([record({ type: "characterData", target: node })])).toEqual([]);
    node.nodeValue = "Notifications";
    const roots = changedRoots([record({ type: "characterData", target: node })]);
    expect(roots).toEqual([node]);
    collect(roots[0]!, { inline, ready: () => true }).forEach((u) => applyUnit(u, lookup));
    expect(node.nodeValue).toBe("Wěn lɛ");
    expect(frenchTextOf(node as unknown as Text)).toBe("Notifications");
  });

  it("takes a whole translated sentence again when React changes one of its runs", () => {
    const count = h("strong", null, "trois");
    const p = h("p", null, "Vous avez ", count, " messages non lus.");
    mount(p);
    const lookup = lookupIn([
      ["Vous avez trois messages non lus.", "A ɖó wɛn atɔ̀n"],
      ["Vous avez quatre messages non lus.", "A ɖó wɛn ɛnɛ"],
    ]);
    units(p).forEach((u) => applyUnit(u, lookup));
    const run = count.childNodes[0] as FakeText;
    run.nodeValue = "quatre";
    const roots = changedRoots([record({ type: "characterData", target: run })]);
    expect(roots).toEqual([p]);
    const [unit] = collect(roots[0]!, { inline, ready: () => true }) as Unit[];
    expect(sourceOf(unit!)).toBe("Vous avez quatre messages non lus.");
    applyUnit(unit!, lookup);
    expect(text(p)).toBe("A ɖó wɛn ɛnɛ");
  });

  it("collects added nodes once, and attributes React set again", () => {
    const dialog = h("dialog", null, h("h2", null, "Mon compte"));
    const inner = dialog.childNodes[0] as FakeElement;
    const body = mount(h("div", null));
    const button = h("button", { "aria-label": "Fermer" });
    body.childNodes.push(dialog, button);
    dialog.parentNode = body;
    button.parentNode = body;
    expect(changedRoots([record({ target: body, addedNodes: [asNode(dialog), asNode(inner)] })])).toEqual([dialog]);
    applyUnit({ kind: "attribute", el: button as unknown as Element, name: "aria-label" }, lookupIn([["Fermer", "Sú"]]));
    expect(changedRoots([record({ type: "attributes", attributeName: "aria-label", target: button })])).toEqual([]);
    button.setAttribute("aria-label", "Fermer le menu");
    expect(changedRoots([record({ type: "attributes", attributeName: "aria-label", target: button })])).toEqual([button]);
    expect(frenchAttribute(button as unknown as Element, "aria-label")).toBe("Fermer le menu");
  });
});
