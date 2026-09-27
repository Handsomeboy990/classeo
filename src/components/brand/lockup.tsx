import Link from "next/link";

import { cn } from "@/lib/utils";

import { FlagStripe } from "./flag";
import { LogoMark } from "./logo";
import { ARMS_RATIO, ARMS_SRC, BRAND_DEFAULTS, type BrandSettings } from "./settings";

// The brand lockup (design source of truth, part 3.1), the one brand block of
// every header, sidebar, app bar, sign in card, footer and status page.
//
// Official mode (brand.official), as the owner decided (decision D5 of the
// conformity journal): Classéo reads as a product, never as an institution
// of the Republic. The coat of arms, then "République du Bénin" as a small
// muted supra-line in spaced capitals over a thin tricolour rule, then the
// product name "Classéo" in sentence case, and the product line
// "Plateforme de gestion scolaire" (not in the app bar, and gone below
// 360 px). With an authority configured (none today: no ministry name is
// shown), the authority names the institution and Classéo follows after a
// thin vertical rule; below 40rem the authority lines give way to Classéo.
// Independent mode: the Classéo mark, the word, the rule and the line
// "Gestion scolaire · Bénin".
//
// The word Classéo is never truncated, at any width from 320 px: nothing in
// the block clips or ellipsises, and below 360 px the small subtitle line is
// the part that goes. Capitals come from CSS, so screen readers read words,
// not letters.
//
// Every inner size is in em of the block's own size: 1rem by default, so the
// block grows with the text size preference; 16 px with `fixed`, so it keeps
// the sizes of part 3.1 at every text size, as a logo does. The navy bars of
// phones and the public footer use `fixed`: with a very large text the block
// would otherwise push the menu and language buttons off the screen, or out
// of its footer column.

export type LockupSize = "header" | "sidebar" | "bar" | "drawer" | "footer" | "auth";

// Height of the coat of arms, of the mark, and size of the name, per place.
// In em of the block (see above). The authority line is 0.625em, so its
// maximum width is in its own em: 13rem there is 20.8em.
const SIZES: Record<LockupSize, { arms: string; mark: string; word: string; authority: string }> = {
  header: { arms: "h-[2.75em] lg:h-[3.5em]", mark: "size-[2.25em] lg:size-[2.5em]", word: "text-[1.125em] lg:text-[1.25em]", authority: "max-w-[20.8em]" },
  sidebar: { arms: "h-[2.5em]", mark: "size-[2.25em]", word: "text-[1.125em]", authority: "max-w-[15.2em]" },
  bar: { arms: "h-[2.5em]", mark: "size-[2em]", word: "text-[1.0625em]", authority: "max-w-[17.6em]" },
  drawer: { arms: "h-[2.5em]", mark: "size-[2em]", word: "text-[1.0625em]", authority: "max-w-[17.6em]" },
  footer: { arms: "h-[4em]", mark: "size-[2.5em]", word: "text-[1.25em]", authority: "max-w-[22.4em]" },
  auth: { arms: "h-[3.5em]", mark: "size-[2.5em]", word: "text-[1.25em]", authority: "max-w-[22.4em]" },
};

// The app bar has no room for the product line ("Gestion scolaire" in the
// independent mode, "Plateforme de gestion scolaire" in the official one).
const NO_SUBTITLE: LockupSize[] = ["bar"];

export const PRODUCT_LINE = "Plateforme de gestion scolaire";

export function BrandLockup({
  brand = BRAND_DEFAULTS,
  tone = "light",
  size = "header",
  href,
  fixed = false,
  className,
}: {
  // From loadBrand() on the server; the defaults otherwise.
  brand?: BrandSettings;
  // dark: on the navy header, sidebar or footer; light: on a light surface.
  tone?: "light" | "dark";
  size?: LockupSize;
  // Makes the whole block the home link, named "Classéo, accueil".
  href?: string;
  // Keeps the px sizes of part 3.1 whatever the text size preference.
  fixed?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  const dark = tone === "dark";
  const name = dark ? "text-header-text" : "text-primary";
  const muted = dark ? "text-header-muted" : "text-muted";
  const subtitle = !NO_SUBTITLE.includes(size);

  // In capitals as the independent logotype; in sentence case as the product
  // name of the official block, never styled as an institution.
  const word = (
    <span
      translate="no"
      className={cn("font-display leading-none font-extrabold whitespace-nowrap", brand.official ? "tracking-[0.01em]" : "tracking-[0.02em] uppercase", s.word, name)}
    >
      Classéo
    </span>
  );

  const body = brand.official ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG, served as is */}
      <img
        src={ARMS_SRC}
        alt=""
        aria-hidden
        width={Math.round(56 * ARMS_RATIO)}
        height={56}
        style={{ aspectRatio: String(ARMS_RATIO) }}
        className={cn("w-auto shrink-0", s.arms)}
        decoding="async"
        data-brand-arms=""
      />
      {brand.authority ? (
        <>
          <span className="flex min-w-0 flex-col gap-[0.25em] max-sm:hidden" data-brand-authority="">
            <span className={cn("font-display text-[0.625em] leading-[1.2] font-bold tracking-[0.02em] text-balance uppercase", s.authority, name)}>{brand.authority}</span>
            <FlagStripe className="h-[0.125em] w-full max-w-[6em]" />
            <Republic className={muted} />
          </span>
          <span aria-hidden className={cn("h-[2em] w-px shrink-0 max-sm:hidden", dark ? "bg-white/20" : "bg-border-strong")} />
          <span className="flex flex-col gap-[0.25em]">
            <span className="inline-flex flex-col gap-[0.25em] self-start">
              {word}
              <FlagStripe className="h-[0.125em] sm:hidden" />
            </span>
            <Republic className={cn("sm:hidden", muted)} />
          </span>
        </>
      ) : (
        // The State above, the product below: the supra-line and its rule,
        // then Classéo and what it is.
        <span className="flex min-w-0 flex-col" data-brand-product="">
          <span className="inline-flex flex-col gap-[0.25em] self-start">
            <Republic className={muted} />
            <FlagStripe className="h-[0.125em]" />
          </span>
          <span className="mt-[0.375em]">{word}</span>
          {subtitle && (
            <span className={cn("mt-[0.3125em] font-display text-[0.6875em] leading-[1.2] font-semibold max-[359px]:hidden", muted)} translate="no">
              {PRODUCT_LINE}
            </span>
          )}
        </span>
      )}
    </>
  ) : (
    <>
      <LogoMark tone={tone} className={s.mark} />
      <span className="flex flex-col gap-[0.25em]">
        <span className="inline-flex flex-col gap-[0.25em] self-start">
          {word}
          <FlagStripe className="h-[0.125em]" />
        </span>
        {subtitle && (
          <span className={cn("font-display text-[0.625em] leading-none font-semibold tracking-widest whitespace-nowrap uppercase max-[359px]:hidden", muted)}>
            Gestion scolaire · Bénin
          </span>
        )}
      </span>
    </>
  );

  const cls = cn(
    "inline-flex min-w-0 shrink-0 items-center gap-[0.75em]",
    fixed ? "text-[16px]" : "text-[1rem]",
    brand.official && brand.authority && "sm:gap-x-[1em]",
    className,
  );
  if (href) {
    return (
      <Link href={href} aria-label="Classéo, accueil" className={cn(cls, "rounded-control")} data-brand-lockup={brand.official ? "official" : "independent"}>
        {body}
      </Link>
    );
  }
  return (
    <span className={cls} data-brand-lockup={brand.official ? "official" : "independent"}>
      {body}
    </span>
  );
}

// "République du Bénin", in small spaced capitals.
function Republic({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[0.5625em] leading-none font-semibold tracking-[0.12em] whitespace-nowrap uppercase", className)} translate="no">
      République du Bénin
    </span>
  );
}
