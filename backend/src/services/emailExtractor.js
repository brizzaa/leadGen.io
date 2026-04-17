import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Tries to extract an email address from a business website.
 * @param {string} websiteUrl
 * @returns {Promise<string|null>}
 */
export async function extractEmail(websiteUrl) {
  if (!websiteUrl) return null;

  try {
    // Ensure URL has protocol
    let url = websiteUrl;
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      maxRedirects: 3,
    });

    const $ = cheerio.load(response.data);

    // 1. Look for mailto: links
    const mailtoLinks = [];
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr("href");
      const email = href.replace("mailto:", "").split("?")[0].trim();
      if (email && isValidEmail(email)) {
        mailtoLinks.push(email);
      }
    });

    if (mailtoLinks.length > 0) return mailtoLinks[0];

    // 2. Look for email pattern in page text
    const bodyText = $("body").text();
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const matches = bodyText.match(emailRegex);

    if (matches) {
      // Filter out common non-emails (images, icons, etc.)
      const filtered = matches.filter(
        (e) =>
          isValidEmail(e) &&
          !e.includes(".png") &&
          !e.includes(".jpg") &&
          !e.includes(".svg") &&
          !e.endsWith(".css") &&
          !e.endsWith(".js"),
      );
      if (filtered.length > 0) return filtered[0];
    }

    return null;
  } catch (err) {
    return null;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
