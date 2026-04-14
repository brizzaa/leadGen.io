import { describe, it, expect } from "vitest";
import { computeLeadScore } from "../leadScore.js";

describe("computeLeadScore", () => {
  it("restituisce 0 per un business con sito, reclamato, senza contatti", () => {
    const biz = {
      website: "https://example.com",
      phone: null,
      email: null,
      review_count: 50,
      rating: 4.5,
      is_claimed: 1,
      facebook_url: null,
      instagram_url: null,
    };
    expect(computeLeadScore(biz)).toBe(0);
  });

  it("assegna +30 se non ha sito web", () => {
    const biz = { website: null, is_claimed: 1 };
    expect(computeLeadScore(biz)).toBeGreaterThanOrEqual(30);
  });

  it("assegna +30 anche se website è stringa vuota o 'None'", () => {
    expect(computeLeadScore({ website: "", is_claimed: 1 })).toBeGreaterThanOrEqual(30);
    expect(computeLeadScore({ website: "None", is_claimed: 1 })).toBeGreaterThanOrEqual(30);
  });

  it("assegna +20 se il sito è una pagina Facebook", () => {
    const biz = { website: "https://facebook.com/mybiz", is_claimed: 1 };
    expect(computeLeadScore(biz)).toBe(20);
  });

  it("assegna +20 se il sito è Instagram", () => {
    const biz = { website: "https://instagram.com/mybiz", is_claimed: 1 };
    expect(computeLeadScore(biz)).toBe(20);
  });

  it("assegna +20 se il sito è Linktree", () => {
    const biz = { website: "https://linktr.ee/mybiz", is_claimed: 1 };
    expect(computeLeadScore(biz)).toBe(20);
  });

  it("assegna +10 per telefono disponibile", () => {
    const base = { website: "https://example.com", is_claimed: 1 };
    const withPhone = { ...base, phone: "+39 123 456 7890" };
    expect(computeLeadScore(withPhone) - computeLeadScore(base)).toBe(10);
  });

  it("assegna +10 per email disponibile", () => {
    const base = { website: "https://example.com", is_claimed: 1 };
    const withEmail = { ...base, email: "info@test.it" };
    expect(computeLeadScore(withEmail) - computeLeadScore(base)).toBe(10);
  });

  it("assegna +10 per poche recensioni (< 10)", () => {
    const base = { website: "https://example.com", is_claimed: 1 };
    const fewReviews = { ...base, review_count: 3 };
    expect(computeLeadScore(fewReviews) - computeLeadScore(base)).toBe(10);
  });

  it("non assegna bonus recensioni se >= 10", () => {
    const base = { website: "https://example.com", is_claimed: 1 };
    const manyReviews = { ...base, review_count: 50 };
    expect(computeLeadScore(manyReviews)).toBe(computeLeadScore(base));
  });

  it("assegna +5 per rating basso (< 4.0)", () => {
    const base = { website: "https://example.com", is_claimed: 1 };
    const lowRating = { ...base, rating: 3.2 };
    expect(computeLeadScore(lowRating) - computeLeadScore(base)).toBe(5);
  });

  it("assegna +15 se non reclamato", () => {
    const claimed = { website: "https://example.com", is_claimed: 1 };
    const unclaimed = { website: "https://example.com", is_claimed: 0 };
    expect(computeLeadScore(unclaimed) - computeLeadScore(claimed)).toBe(15);
  });

  it("assegna +5 bonus social senza sito", () => {
    const noSite = { website: null, is_claimed: 1 };
    const noSiteWithSocial = { ...noSite, facebook_url: "https://facebook.com/biz" };
    expect(computeLeadScore(noSiteWithSocial) - computeLeadScore(noSite)).toBe(5);
  });

  it("non supera mai 100", () => {
    const maxBiz = {
      website: null,
      phone: "+39 123",
      email: "a@b.it",
      review_count: 2,
      rating: 2.0,
      is_claimed: 0,
      facebook_url: "https://facebook.com/x",
      instagram_url: "https://instagram.com/x",
    };
    expect(computeLeadScore(maxBiz)).toBeLessThanOrEqual(100);
  });

  it("calcola il massimo correttamente: no sito + contatti + poche rec + rating basso + non reclamato + social", () => {
    const maxBiz = {
      website: null,         // +30
      phone: "+39 123",      // +10
      email: "a@b.it",       // +10
      review_count: 2,       // +10
      rating: 2.0,           // +5
      is_claimed: 0,         // +15
      facebook_url: "https://facebook.com/x", // +5 (social senza sito)
    };
    // 30 + 10 + 10 + 10 + 5 + 15 + 5 = 85
    expect(computeLeadScore(maxBiz)).toBe(85);
  });
});
