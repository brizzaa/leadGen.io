/**
 * Calcola un lead score 0-100 basato sui segnali disponibili.
 * Più alto = lead più caldo (business che ha bisogno di servizi web).
 */
export function computeLeadScore(biz) {
  let score = 0;

  // Nessun sito web → segnale fortissimo (+30)
  const noSite = !biz.website || biz.website === "" || biz.website === "None";
  if (noSite) score += 30;

  // Sito è solo una pagina social (+20)
  if (!noSite) {
    const w = biz.website.toLowerCase();
    if (w.includes("facebook.com") || w.includes("instagram.com") || w.includes("linktr.ee")) {
      score += 20;
    }
  }

  // Ha telefono o email → contattabile (+10 ciascuno)
  if (biz.phone) score += 10;
  if (biz.email) score += 10;

  // Poche recensioni → business piccolo, più ricettivo (+10)
  if (biz.review_count != null && biz.review_count < 10) score += 10;

  // Rating basso → potrebbe voler migliorare presenza (+5)
  if (biz.rating != null && biz.rating < 4.0) score += 5;

  // Non reclamato su Google → non curano il digitale (+15)
  if (biz.is_claimed === 0) score += 15;

  // Ha social ma non sito → sa che serve presenza online (+5)
  if (noSite && (biz.facebook_url || biz.instagram_url)) score += 5;

  return Math.min(score, 100);
}
