import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Page introuvable" };

// Any address of the space that matches no page. Without this route it would
// fall through to the public 404 (public header and footer, "Se connecter")
// in front of a signed in person; here the layout of the space renders first
// (it signs the visitor in if needed), then its own not-found page, inside
// the shell with the menu and the tab bar (design source of truth, 4.13).
// Every real route of the space is more specific and wins over this one.
export default function MissingSpacePage(): never {
  notFound();
}
