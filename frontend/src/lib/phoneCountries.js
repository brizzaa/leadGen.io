/**
 * Registro paesi per rilevamento numeri mobile e formattazione WhatsApp.
 * Per aggiungere un paese: aggiungi una entry in COUNTRY_REGISTRY.
 */

export const COUNTRY_REGISTRY = {
  IT: {
    name: "Italia",
    dialCode: "+39",
    // Numeri mobili italiani iniziano con 3 (senza prefisso paese)
    isMobile: (local) => /^3\d{8,9}$/.test(local),
    // Rimuove prefisso paese se presente, restituisce numero locale
    toLocal: (raw) => {
      const clean = raw.replace(/[\s\-().]/g, "");
      if (clean.startsWith("+39")) return clean.slice(3);
      if (clean.startsWith("0039")) return clean.slice(4);
      return clean;
    },
    waMessage: (business, senderName) =>
      `Ciao! Sono ${senderName}, mi occupo di siti web professionali per attività locali come ${business.name}. ` +
      `Ho notato che potreste beneficiare di una maggiore presenza online. ` +
      `Posso mostrarvi una demo gratuita? Ci vogliono solo 5 minuti! 😊`,
  },

  ES: {
    name: "Spagna",
    dialCode: "+34",
    // Mobili spagnoli: 6xx o 7xx
    isMobile: (local) => /^[67]\d{8}$/.test(local),
    toLocal: (raw) => {
      const clean = raw.replace(/[\s\-().]/g, "");
      if (clean.startsWith("+34")) return clean.slice(3);
      if (clean.startsWith("0034")) return clean.slice(4);
      return clean;
    },
    waMessage: (business, senderName) =>
      `¡Hola! Soy ${senderName}, me dedico a crear sitios web profesionales para negocios locales como ${business.name}. ` +
      `He notado que podrían beneficiarse de mayor presencia online. ` +
      `¿Puedo mostrarles una demo gratuita? ¡Solo 5 minutos! 😊`,
  },

  FR: {
    name: "Francia",
    dialCode: "+33",
    // Mobili francesi: 06xx o 07xx
    isMobile: (local) => /^0?[67]\d{8}$/.test(local),
    toLocal: (raw) => {
      const clean = raw.replace(/[\s\-().]/g, "");
      if (clean.startsWith("+33")) return clean.slice(3);
      if (clean.startsWith("0033")) return clean.slice(4);
      // i numeri francesi locali iniziano con 0
      if (clean.startsWith("0")) return clean.slice(1);
      return clean;
    },
    waMessage: (business, senderName) =>
      `Bonjour ! Je suis ${senderName}, je crée des sites web professionnels pour des entreprises locales comme ${business.name}. ` +
      `J'ai remarqué que vous pourriez bénéficier d'une meilleure présence en ligne. ` +
      `Je peux vous montrer une démo gratuite en 5 minutes ! 😊`,
  },

  AT: {
    name: "Austria",
    dialCode: "+43",
    // Mobili austriaci: 06xx
    isMobile: (local) => /^0?6\d{7,12}$/.test(local),
    toLocal: (raw) => {
      const clean = raw.replace(/[\s\-().]/g, "");
      if (clean.startsWith("+43")) return clean.slice(3);
      if (clean.startsWith("0043")) return clean.slice(4);
      if (clean.startsWith("0")) return clean.slice(1);
      return clean;
    },
    waMessage: (business, senderName) =>
      `Hallo! Ich bin ${senderName} und erstelle professionelle Websites für lokale Unternehmen wie ${business.name}. ` +
      `Ich habe bemerkt, dass Sie von mehr Online-Präsenz profitieren könnten. ` +
      `Darf ich Ihnen eine kostenlose Demo in 5 Minuten zeigen? 😊`,
  },

  DE: {
    name: "Germania",
    dialCode: "+49",
    // Mobili tedeschi: 015x, 016x, 017x
    isMobile: (local) => /^0?1[567]\d{7,10}$/.test(local),
    toLocal: (raw) => {
      const clean = raw.replace(/[\s\-().]/g, "");
      if (clean.startsWith("+49")) return clean.slice(3);
      if (clean.startsWith("0049")) return clean.slice(4);
      if (clean.startsWith("0")) return clean.slice(1);
      return clean;
    },
    waMessage: (business, senderName) =>
      `Hallo! Ich bin ${senderName} und erstelle professionelle Websites für lokale Unternehmen wie ${business.name}. ` +
      `Ich würde Ihnen gerne eine kostenlose Demo in nur 5 Minuten zeigen! 😊`,
  },
};

/**
 * Rileva il paese di un numero di telefono grezzo.
 * Ritorna la chiave paese (es. "IT") o null se non riconosciuto.
 */
export function detectCountry(rawPhone) {
  if (!rawPhone) return null;
  const clean = rawPhone.replace(/[\s\-().]/g, "");

  for (const [code, country] of Object.entries(COUNTRY_REGISTRY)) {
    const dialClean = country.dialCode.replace("+", "");
    if (clean.startsWith("+" + dialClean) || clean.startsWith("00" + dialClean)) {
      const local = country.toLocal(rawPhone);
      if (country.isMobile(local)) return code;
    }
  }

  // Fallback: prova senza prefisso (numero locale puro — assume paese di default)
  return null;
}

/**
 * Verifica se un numero è mobile per il paese dato (o auto-detect).
 * @param {string} rawPhone
 * @param {string} [countryCode] — es. "IT". Se omesso, prova auto-detect + fallback IT.
 */
export function isMobilePhone(rawPhone, countryCode = "IT") {
  if (!rawPhone) return false;
  const country = COUNTRY_REGISTRY[countryCode];
  if (!country) return false;
  const local = country.toLocal(rawPhone);
  return country.isMobile(local);
}

/**
 * Costruisce l'URL WhatsApp per un numero e business.
 * @param {string} rawPhone
 * @param {object} business
 * @param {string} senderName
 * @param {string} [countryCode]
 */
export function buildWhatsAppUrl(rawPhone, business, senderName = "Luca", countryCode = "IT") {
  const country = COUNTRY_REGISTRY[countryCode] || COUNTRY_REGISTRY.IT;
  const local = country.toLocal(rawPhone);
  const e164 = country.dialCode.replace("+", "") + local;
  const msg = country.waMessage(business, senderName);
  return `https://wa.me/${e164}?text=${encodeURIComponent(msg)}`;
}
