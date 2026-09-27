import Link from "next/link";

import { cn } from "@/lib/utils";

import { FlagStripe } from "./flag";
import { LogoMark } from "./logo";
import { ARMS_RATIO, ARMS_SRC, BRAND_DEFAULTS, type BrandSettings } from "./settings";

// The brand lockup (design source of truth, part 3.1), the one brand block of
// every header, sidebar, app bar, sign in card, footer and status page.
//
// Official mode (brand.official): the coat of arms, the institution name in
// capitals, a thin tricolour rule and "République du Bénin". With an
// authority configured, the authority names the institution and the word
// Classéo follows after a thin vertical rule; below 40rem the authority
// lines give way to Classéo so the block always fits.
// Independent mode: the Classéo mark, the word, the rule and the line
// "Gestion scolaire · Bénin".
//
// The word Classéo is never truncated, at any width from 320 px: nothing in
// the block clips or ellipsises, and below 360 px the small subtitle line is
// the part that goes. Capitals come from CSS, so screen readers read words,
// not letters.

export type LockupSize = "header" | "sidebar" | "bar" | "drawer" | "footer" | "auth";

// Height of the coat of arms, of the mark, and size of the name, per place.
const SIZES: Record<LockupSize, { arms: string; mark: string; word: string; authority: string }> = {
  header: { arms: "h-11 lg:h-14", mark: "size-9 lg:size-10", word: "text-[1.125rem] lg:text-[1.25rem]", authority: "max-w-[13rem]" },
  sidebar: { arms: "h-10", mark: "size-9", word: "text-[1.125rem]", authority: "max-w-[9.5rem]" },
  bar: { arms: "h-10", mark: "size-8", word: "text-[1.0625rem]", authority: "max-w-[11rem]" },
  drawer: { arms: "h-10", mark: "size-8", word: "text-[1.0625rem]", authority: "max-w-[11rem]" },
  footer: { arms: "h-16", mark: "size-10", word: "text-[1.25rem]", authority: "max-w-[14rem]" },
  auth: { arms: "h-14", mark: "size-10", word: "text-[1.25rem]", authority: "max-w-[14rem]" },
};

// Independent mode: the app bar has no room for the "Gestion scolaire"
// line, the name stands alone there.
const NO_SUBTITLE: LockupSize[] = ["bar"];

export function BrandLockup({
  brand = BRAND_DEFAULTS,
  tone = "light",
  size = "header",
  href,
  className,
}: {
  // From loadBrand() on the server; the defaults otherwise.
  brand?: BrandSettings;
  // dark: on the navy header, sidebar or footer; light: on a light surface.
  tone?: "light" | "dark";
  size?: LockupSize;
  // Makes the whole block the home link, named "Classéo, accueil".
  href?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const dark = tone === "dark";
  const name = dark ? "text-header-text" : "text-primary";
  const muted = dark ? "text-header-muted" : "text-muted";
  // "République du Bénin" belongs to the official block wherever it shows.
  const subtitle = brand.official || !NO_SUBTITLE.includes(size);

  const word = (
    <span translate="no" className={cn("font-display leading-none font-extrabold tracking-[0.02em] whitespace-nowrap uppercase", s.word, name)}>
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
          <span className="flex min-w-0 flex-col gap-1 max-sm:hidden" data-brand-authority="">
            <span className={cn("font-display text-[0.625rem] leading-[1.2] font-bold tracking-[0.02em] text-balance uppercase", s.authority, name)}>{brand.authority}</span>
            <FlagStripe className="h-0.5 w-full max-w-24" />
            {subtitle && <Republic className={muted} />}
          </span>
          <span aria-hidden className={cn("h-8 w-px shrink-0 max-sm:hidden", dark ? "bg-white/20" : "bg-border-strong")} />
          <span className="flex flex-col gap-1">
            <span className="inline-flex flex-col gap-1 self-start">
              {word}
              <FlagStripe className="h-0.5 sm:hidden" />
            </span>
            {subtitle && <Republic className={cn("sm:hidden", muted)} />}
          </span>
        </>
      ) : (
        <span className="flex flex-col gap-1">
          <span className="inline-flex flex-col gap-1 self-start">
            {word}
            <FlagStripe className="h-0.5" />
          </span>
          {subtitle && <Republic className={muted} />}
        </span>
      )}
    </>
  ) : (
    <>
      <LogoMark tone={tone} className={s.mark} />
      <span className="flex flex-col gap-1">
        <span className="inline-flex flex-col gap-1 self-start">
          {word}
          <FlagStripe className="h-0.5" />
        </span>
        {subtitle && (
          <span className={cn("font-display text-[0.625rem] leading-none font-semibold tracking-widest whitespace-nowrap uppercase max-[359px]:hidden", muted)}>
            Gestion scolaire · Bénin
          </span>
        )}
      </span>
    </>
  );

  const cls = cn("inline-flex min-w-0 shrink-0 items-center gap-3", brand.official && brand.authority && "gap-x-3 sm:gap-x-4", className);
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

// "République du Bénin", in spaced capitals under the rule.
function Republic({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[0.5625rem] leading-none font-semibold tracking-[0.12em] whitespace-nowrap uppercase", className)} translate="no">
      République du Bénin
    </span>
  );
}
