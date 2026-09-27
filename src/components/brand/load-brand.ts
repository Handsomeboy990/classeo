import "server-only";

import { featureConfig, isEnabled } from "@/lib/features";

import { BRAND_DEFAULTS, type BrandSettings } from "./settings";

// Reads the two brand options on the server. A layout calls it once and
// passes the result to BrandLockup and IndependenceNotice, including through
// client components. When the options cannot be read (no database at build
// time), the defaults apply.
export async function loadBrand(): Promise<BrandSettings> {
  try {
    const [official, config, notice] = await Promise.all([
      isEnabled("brand.official"),
      featureConfig("brand.official"),
      isEnabled("brand.independenceNotice"),
    ]);
    const cfg = config as { authority?: unknown; decisionReference?: unknown };
    return {
      official,
      authority: typeof cfg.authority === "string" ? cfg.authority.trim() : "",
      decisionReference: typeof cfg.decisionReference === "string" ? cfg.decisionReference : "",
      notice,
    };
  } catch {
    return BRAND_DEFAULTS;
  }
}
