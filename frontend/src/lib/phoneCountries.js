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
    waMessage: (business, senderName) => {
      const n = business.name;
      const hasWeb = !!business.website;
      const hasFb  = !!business.facebook_url;
      const fewRev = !business.review_count || business.review_count < 10;
      const unclaimed = !business.is_claimed;
      if (!hasWeb && !hasFb)
        return `Ciao! Sono ${senderName}. Ho cercato ${n} online e ho notato che non avete ancora una presenza digitale. Al giorno d'oggi molti clienti cercano prima su Google — potrei aiutarvi a non perdere queste opportunità. Posso mostrarvi in 15 minuti cosa si potrebbe fare di concreto, senza impegno?`;
      if (!hasWeb && hasFb)
        return `Ciao! Sono ${senderName}. Ho visto ${n} su Facebook — ottimo inizio! Ho notato però che non avete ancora un sito web: molti clienti si fidano di più delle attività che ne hanno uno. Posso mostrarvi in 15 minuti cosa si potrebbe fare, senza impegno?`;
      if (fewRev)
        return `Ciao! Sono ${senderName}. Ho visto ${n} su Google e ho notato che avete poche recensioni online. Una reputazione digitale più solida porta molti più clienti. Posso mostrarvi in 15 minuti come migliorare la vostra visibilità, senza impegno?`;
      if (unclaimed)
        return `Ciao! Sono ${senderName}. Ho notato che la scheda Google di ${n} non è ancora stata rivendicata — questo significa che non controllate le informazioni che i clienti vedono. Posso aiutarvi a sistemarla e a migliorare la vostra presenza online in poco tempo?`;
      return `Ciao! Sono ${senderName}. Ho visto ${n} online e credo ci siano opportunità concrete per migliorare la vostra presenza digitale e acquisire più clienti. Posso mostrarvi in 15 minuti alcune idee, senza impegno?`;
    },
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
    waMessage: (business, senderName) => {
      const n = business.name;
      const hasWeb = !!business.website;
      const hasFb  = !!business.facebook_url;
      const fewRev = !business.review_count || business.review_count < 10;
      const unclaimed = !business.is_claimed;
      if (!hasWeb && !hasFb)
        return `¡Hola! Soy ${senderName}. He buscado ${n} online y he notado que todavía no tienen presencia digital. Hoy en día muchos clientes buscan primero en Google — podría ayudarles a no perder esas oportunidades. ¿Puedo mostrarles en 15 minutos qué se podría hacer, sin compromiso?`;
      if (!hasWeb && hasFb)
        return `¡Hola! Soy ${senderName}. He visto ${n} en Facebook — ¡buen comienzo! Pero he notado que todavía no tienen web: muchos clientes confían más en los negocios que sí la tienen. ¿Puedo mostrarles en 15 minutos qué se podría hacer, sin compromiso?`;
      if (fewRev)
        return `¡Hola! Soy ${senderName}. He visto ${n} en Google y he notado que tienen pocas reseñas online. Una reputación digital más sólida atrae muchos más clientes. ¿Puedo mostrarles en 15 minutos cómo mejorar su visibilidad, sin compromiso?`;
      if (unclaimed)
        return `¡Hola! Soy ${senderName}. He notado que el perfil de Google de ${n} no está reclamado — esto significa que no controlan la información que ven sus clientes. ¿Puedo ayudarles a solucionarlo y mejorar su presencia online?`;
      return `¡Hola! Soy ${senderName}. He visto ${n} online y creo que hay oportunidades concretas para mejorar su presencia digital y conseguir más clientes. ¿Puedo mostrarles en 15 minutos algunas ideas, sin compromiso?`;
    },
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
    waMessage: (business, senderName) => {
      const n = business.name;
      const hasWeb = !!business.website;
      const hasFb  = !!business.facebook_url;
      const fewRev = !business.review_count || business.review_count < 10;
      const unclaimed = !business.is_claimed;
      if (!hasWeb && !hasFb)
        return `Bonjour ! Je suis ${senderName}. J'ai cherché ${n} en ligne et j'ai remarqué que vous n'avez pas encore de présence digitale. Aujourd'hui, beaucoup de clients cherchent d'abord sur Google — je pourrais vous aider à ne pas manquer ces opportunités. Puis-je vous montrer en 15 minutes ce qu'on pourrait faire, sans engagement ?`;
      if (!hasWeb && hasFb)
        return `Bonjour ! Je suis ${senderName}. J'ai vu ${n} sur Facebook — bon début ! Mais j'ai remarqué que vous n'avez pas encore de site web : beaucoup de clients font davantage confiance aux entreprises qui en ont un. Puis-je vous montrer en 15 minutes ce qu'on pourrait faire, sans engagement ?`;
      if (fewRev)
        return `Bonjour ! Je suis ${senderName}. J'ai vu ${n} sur Google et j'ai remarqué que vous avez peu d'avis en ligne. Une réputation digitale plus solide attire beaucoup plus de clients. Puis-je vous montrer en 15 minutes comment améliorer votre visibilité, sans engagement ?`;
      if (unclaimed)
        return `Bonjour ! Je suis ${senderName}. J'ai remarqué que la fiche Google de ${n} n'est pas encore revendiquée — vous ne contrôlez donc pas les informations visibles par vos clients. Puis-je vous aider à corriger ça et améliorer votre présence en ligne ?`;
      return `Bonjour ! Je suis ${senderName}. J'ai vu ${n} en ligne et je pense qu'il y a des opportunités concrètes pour améliorer votre présence digitale et attirer plus de clients. Puis-je vous montrer en 15 minutes quelques idées, sans engagement ?`;
    },
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
    waMessage: (business, senderName) => {
      const n = business.name;
      const hasWeb = !!business.website;
      const hasFb  = !!business.facebook_url;
      const fewRev = !business.review_count || business.review_count < 10;
      const unclaimed = !business.is_claimed;
      if (!hasWeb && !hasFb)
        return `Hallo! Ich bin ${senderName}. Ich habe ${n} online gesucht und festgestellt, dass Sie noch keine digitale Präsenz haben. Heutzutage suchen viele Kunden zuerst bei Google — ich könnte Ihnen helfen, diese Chancen nicht zu verpassen. Darf ich Ihnen in 15 Minuten zeigen, was möglich wäre, unverbindlich?`;
      if (!hasWeb && hasFb)
        return `Hallo! Ich bin ${senderName}. Ich habe ${n} auf Facebook gesehen — guter Anfang! Ich habe aber bemerkt, dass Sie noch keine Website haben: viele Kunden vertrauen Unternehmen mit Website mehr. Darf ich Ihnen in 15 Minuten zeigen, was möglich wäre, unverbindlich?`;
      if (fewRev)
        return `Hallo! Ich bin ${senderName}. Ich habe ${n} bei Google gesehen und bemerkt, dass Sie wenige Online-Bewertungen haben. Eine stärkere digitale Reputation bringt deutlich mehr Kunden. Darf ich Ihnen in 15 Minuten zeigen, wie Sie Ihre Sichtbarkeit verbessern können, unverbindlich?`;
      if (unclaimed)
        return `Hallo! Ich bin ${senderName}. Ich habe bemerkt, dass das Google-Profil von ${n} noch nicht beansprucht wurde — das bedeutet, Sie haben keine Kontrolle über die Informationen, die Ihre Kunden sehen. Darf ich Ihnen helfen, das zu beheben und Ihre Online-Präsenz zu verbessern?`;
      return `Hallo! Ich bin ${senderName}. Ich habe ${n} online gesehen und glaube, dass es konkrete Möglichkeiten gibt, Ihre digitale Präsenz zu verbessern und mehr Kunden zu gewinnen. Darf ich Ihnen in 15 Minuten einige Ideen zeigen, unverbindlich?`;
    },
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
    waMessage: (business, senderName) => {
      const n = business.name;
      const hasWeb = !!business.website;
      const hasFb  = !!business.facebook_url;
      const fewRev = !business.review_count || business.review_count < 10;
      const unclaimed = !business.is_claimed;
      if (!hasWeb && !hasFb)
        return `Hallo! Ich bin ${senderName}. Ich habe ${n} online gesucht und festgestellt, dass Sie noch keine digitale Präsenz haben. Heutzutage suchen viele Kunden zuerst bei Google — ich könnte Ihnen helfen, diese Chancen nicht zu verpassen. Darf ich Ihnen in 15 Minuten zeigen, was möglich wäre, unverbindlich?`;
      if (!hasWeb && hasFb)
        return `Hallo! Ich bin ${senderName}. Ich habe ${n} auf Facebook gesehen — guter Anfang! Ich habe aber bemerkt, dass Sie noch keine Website haben: viele Kunden vertrauen Unternehmen mit Website mehr. Darf ich Ihnen in 15 Minuten zeigen, was möglich wäre, unverbindlich?`;
      if (fewRev)
        return `Hallo! Ich bin ${senderName}. Ich habe ${n} bei Google gesehen und bemerkt, dass Sie wenige Online-Bewertungen haben. Eine stärkere digitale Reputation bringt deutlich mehr Kunden. Darf ich Ihnen in 15 Minuten zeigen, wie Sie Ihre Sichtbarkeit verbessern können, unverbindlich?`;
      if (unclaimed)
        return `Hallo! Ich bin ${senderName}. Ich habe bemerkt, dass das Google-Profil von ${n} noch nicht beansprucht wurde — das bedeutet, Sie haben keine Kontrolle über die Informationen, die Ihre Kunden sehen. Darf ich Ihnen helfen, das zu beheben und Ihre Online-Präsenz zu verbessern?`;
      return `Hallo! Ich bin ${senderName}. Ich habe ${n} online gesehen und glaube, dass es konkrete Möglichkeiten gibt, Ihre digitale Präsenz zu verbessern und mehr Kunden zu gewinnen. Darf ich Ihnen in 15 Minuten einige Ideen zeigen, unverbindlich?`;
    },
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
