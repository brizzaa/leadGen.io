import { describe, it, expect } from "vitest";
import { makeSlug, determineTemplate, WEBSITE_STYLES, WEBSITE_ENGINES } from "../landingPageBuilder.js";

describe("makeSlug", () => {
  it("converte nome in slug lowercase", () => {
    expect(makeSlug("Pizzeria Da Mario")).toBe("pizzeria-da-mario");
  });

  it("rimuove accenti", () => {
    expect(makeSlug("Caffè Città")).toBe("caffe-citta");
  });

  it("rimuove caratteri speciali", () => {
    expect(makeSlug("Bar & Grill (Centro)")).toBe("bar-grill-centro");
  });

  it("collassa spazi e trattini multipli", () => {
    expect(makeSlug("La   Bella   ---  Vita")).toBe("la-bella-vita");
  });

  it("tronca a 30 caratteri", () => {
    const long = "Ristorante Trattoria Pizzeria Da Giovanni E Maria";
    expect(makeSlug(long).length).toBeLessThanOrEqual(30);
  });

  it("rimuove trattino finale", () => {
    // 30 chars potrebbe tagliare a metà creando un trattino finale
    const result = makeSlug("abcdefghijklmnopqrstuvwxyz-abcde");
    expect(result.endsWith("-")).toBe(false);
  });
});

describe("determineTemplate", () => {
  it("restituisce 'social-first' se ha social ma non sito", () => {
    const biz = { facebook_url: "https://facebook.com/biz", website: null };
    expect(determineTemplate(biz)).toBe("social-first");
  });

  it("restituisce 'digital-presence' se il sito è Facebook", () => {
    const biz = { website: "https://facebook.com/mybiz" };
    expect(determineTemplate(biz)).toBe("digital-presence");
  });

  it("restituisce 'digital-presence' se il sito è Instagram", () => {
    const biz = { website: "https://instagram.com/mybiz" };
    expect(determineTemplate(biz)).toBe("digital-presence");
  });

  it("restituisce 'digital-presence' se il sito è Linktree", () => {
    const biz = { website: "https://linktr.ee/mybiz" };
    expect(determineTemplate(biz)).toBe("digital-presence");
  });

  it("restituisce 'digital-presence' se non ha sito e non ha social", () => {
    const biz = { website: null, facebook_url: null, instagram_url: null };
    expect(determineTemplate(biz)).toBe("digital-presence");
  });

  it("restituisce 'local-pro' se ha un sito web reale", () => {
    const biz = { website: "https://pizzeriadamario.it" };
    expect(determineTemplate(biz)).toBe("local-pro");
  });

  it("gestisce website = 'None' come assente", () => {
    const biz = { website: "None" };
    expect(determineTemplate(biz)).toBe("digital-presence");
  });

  it("gestisce website = '' come assente", () => {
    const biz = { website: "" };
    expect(determineTemplate(biz)).toBe("digital-presence");
  });
});

describe("WEBSITE_STYLES", () => {
  it("contiene gli stili richiesti", () => {
    const keys = Object.keys(WEBSITE_STYLES);
    expect(keys).toContain("auto");
    expect(keys).toContain("elegant");
    expect(keys).toContain("bold");
    expect(keys).toContain("warm");
    expect(keys).toContain("professional");
    expect(keys).toContain("creative");
  });

  it("ogni stile ha label, desc e prompt", () => {
    for (const [key, style] of Object.entries(WEBSITE_STYLES)) {
      expect(style).toHaveProperty("label");
      expect(style).toHaveProperty("desc");
      expect(style).toHaveProperty("prompt");
      expect(typeof style.label).toBe("string");
      expect(style.label.length).toBeGreaterThan(0);
    }
  });

  it("auto ha prompt vuoto", () => {
    expect(WEBSITE_STYLES.auto.prompt).toBe("");
  });

  it("gli altri stili hanno prompt non vuoto", () => {
    for (const [key, style] of Object.entries(WEBSITE_STYLES)) {
      if (key !== "auto") {
        expect(style.prompt.length).toBeGreaterThan(20);
      }
    }
  });
});

describe("WEBSITE_ENGINES", () => {
  it("contiene gli engine richiesti", () => {
    const keys = Object.keys(WEBSITE_ENGINES);
    expect(keys).toContain("stitch");
    expect(keys).toContain("gemini_pro");
    expect(keys).toContain("gemini_flash");
  });

  it("ogni engine ha label e desc", () => {
    for (const [, engine] of Object.entries(WEBSITE_ENGINES)) {
      expect(engine).toHaveProperty("label");
      expect(engine).toHaveProperty("desc");
      expect(typeof engine.label).toBe("string");
      expect(engine.label.length).toBeGreaterThan(0);
    }
  });
});
