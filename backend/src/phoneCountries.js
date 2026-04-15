/**
 * Registro paesi per rilevamento numeri mobile.
 * Speculare a frontend/src/lib/phoneCountries.js
 * Aggiungere qui un paese lo rende disponibile sia in frontend che backend.
 */
export const COUNTRY_REGISTRY = {
  IT: {
    dialCode: "39",
    // Pattern SQL LIKE per numeri mobili italiani (iniziano con 3)
    sqlLikePatterns: ["3%", "+39 3%", "+393%", "0039 3%", "00393%"],
  },
  ES: {
    dialCode: "34",
    sqlLikePatterns: ["6%", "7%", "+34 6%", "+34 7%", "+346%", "+347%"],
  },
  FR: {
    dialCode: "33",
    sqlLikePatterns: ["06%", "07%", "+33 6%", "+33 7%", "+336%", "+337%"],
  },
  AT: {
    dialCode: "43",
    sqlLikePatterns: ["06%", "+43 6%", "+436%"],
  },
  DE: {
    dialCode: "49",
    sqlLikePatterns: ["015%", "016%", "017%", "+49 15%", "+49 16%", "+49 17%"],
  },
};

/**
 * Genera la clausola SQL WHERE per numeri mobili di tutti i paesi nel registro.
 * Aggiungere un paese al registro lo include automaticamente nel filtro.
 */
export function buildMobilePhoneSqlClause(phoneCol = "phone") {
  const patterns = Object.values(COUNTRY_REGISTRY)
    .flatMap((c) => c.sqlLikePatterns)
    .map((p) => `${phoneCol} LIKE '${p}'`)
    .join(" OR ");
  return `(${phoneCol} IS NOT NULL AND ${phoneCol} != '' AND (${patterns}))`;
}
