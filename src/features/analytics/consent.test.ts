import { describe, expect, it } from "vitest";

import { CONSENT_KEY, gaCookieNames, gaPagePath, mayAsk, mayLoad, readConsent, validGaId } from "./consent";

const storage = (value: string | null) => ({ getItem: (k: string) => (k === CONSENT_KEY ? value : null) });

describe("Google Analytics consent", () => {
  it("accepts a measurement id only", () => {
    expect(validGaId("G-ABC123XYZ")).toBe("G-ABC123XYZ");
    expect(validGaId("UA-1234-1")).toBeNull();
    expect(validGaId("G-<script>")).toBeNull();
    expect(validGaId(undefined)).toBeNull();
  });

  it("reads the stored choice, nothing else", () => {
    expect(readConsent(storage("granted"))).toBe("granted");
    expect(readConsent(storage("denied"))).toBe("denied");
    expect(readConsent(storage("yes"))).toBeNull();
    expect(readConsent(null)).toBeNull();
    expect(readConsent({ getItem: () => { throw new Error("blocked"); } })).toBeNull();
  });

  it("never loads before consent, on the private space or against Do Not Track", () => {
    const base = { gaId: "G-ABC123", pathname: "/", nav: { doNotTrack: null } };
    expect(mayLoad({ ...base, consent: null })).toBe(false);
    expect(mayLoad({ ...base, consent: "denied" })).toBe(false);
    expect(mayLoad({ ...base, consent: "granted" })).toBe(true);
    expect(mayLoad({ ...base, pathname: "/espace/eleves", consent: "granted" })).toBe(false);
    expect(mayLoad({ ...base, pathname: "/acces/token", consent: "granted" })).toBe(false);
    expect(mayLoad({ ...base, nav: { globalPrivacyControl: true }, consent: "granted" })).toBe(false);
    expect(mayAsk({ ...base, gaId: null })).toBe(false);
  });

  it("sends Google a path without identifiers or query", () => {
    expect(gaPagePath("/verifier/K7QD4-M2XPH")).toBe("/verifier/[id]");
    expect(gaPagePath("/connexion")).toBe("/connexion");
  });

  it("finds the Google cookies to remove", () => {
    expect(gaCookieNames("_ga=GA1.1.1; theme=dark; _ga_ABC=GS1; _gid=x; classeo_session=y")).toEqual(["_ga", "_ga_ABC", "_gid"]);
  });
});
