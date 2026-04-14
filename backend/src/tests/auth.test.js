import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../auth.js";

describe("JWT auth", () => {
  it("genera e verifica un token valido", () => {
    const token = signToken(42);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(42);
  });

  it("token contiene exp", () => {
    const token = signToken(1);
    const decoded = verifyToken(token);
    expect(decoded).toHaveProperty("exp");
    expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("token scaduto/invalido lancia errore", () => {
    expect(() => verifyToken("invalid.token.here")).toThrow();
  });

  it("token diversi per user diversi", () => {
    const t1 = signToken(1);
    const t2 = signToken(2);
    expect(t1).not.toBe(t2);
    expect(verifyToken(t1).userId).toBe(1);
    expect(verifyToken(t2).userId).toBe(2);
  });
});
