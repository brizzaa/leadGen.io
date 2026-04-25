import nodemailer from "nodemailer";
import crypto from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getDb } from "../config/db.js";
import { renderWebsitePreviewEmail } from "../emails/WebsitePreviewEmail.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class EmailCredentialsError extends Error {}

function buildTransporter() {
  // Brevo SMTP — reputazione molto migliore di Gmail per cold outreach
  if (process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_KEY) {
    return nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_KEY },
    });
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new EmailCredentialsError(
      "Credenziali email non configurate nel file .env. Aggiungi BREVO_SMTP_USER + BREVO_SMTP_KEY oppure EMAIL_USER + EMAIL_PASS.",
    );
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

function trackingPixelTag(token) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  // /t/ path → CF Worker tracking. /api/track/ → fallback Express locale.
  const path = process.env.BASE_URL ? "/t/" : "/api/track/";
  return `<img src="${baseUrl}${path}${token}" width="1" height="1" style="display:none" alt="" />`;
}

function registerTrackingToken(businessId) {
  const token = crypto.randomBytes(16).toString("hex");
  getDb()
    .prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)")
    .run(businessId, token);
  return token;
}

export async function sendOutreachEmail({ businessId, toEmail, subject, body, businessName, websiteUrl, screenshotPath }) {
  const transporter = buildTransporter();
  const token = registerTrackingToken(businessId);
  const screenshotCid = "website-preview";
  const senderName = process.env.MY_NAME || "Studio Web";
  const senderEmail = process.env.EMAIL_USER;
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const unsubscribeUrl = `${baseUrl}/api/track/unsubscribe/${token}`;
  const unsubscribeMailto = `mailto:${senderEmail}?subject=Unsubscribe`;

  let html = await renderWebsitePreviewEmail({
    businessName: businessName || "",
    emailBody: body,
    websiteUrl: websiteUrl || null,
    screenshotCid,
    unsubscribeUrl,
  });

  html = html.replace("</body>", `${trackingPixelTag(token)}</body>`);

  // screenshotPath may be a relative URL (/uploads/...) or absolute filesystem path
  const absScreenshot = screenshotPath
    ? screenshotPath.startsWith("/uploads/")
      ? join(__dirname, "../../..", screenshotPath)
      : screenshotPath
    : null;

  const attachments = absScreenshot
    ? [{ filename: "preview.jpg", path: absScreenshot, cid: screenshotCid }]
    : [];

  await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    replyTo: senderEmail,
    to: toEmail,
    subject: subject || "Richiesta di contatto",
    text: `${body}\n\n---\nMittente: ${senderName} <${senderEmail}>\nDati raccolti da fonti pubbliche (Google Maps, sito aziendale). Base giuridica: legittimo interesse ex art. 6.1.f Reg. UE 2016/679.\nInformativa privacy: https://privacy.leader-gen.com\nPer non ricevere più queste email (un click): ${unsubscribeUrl}`,
    html,
    attachments,
    headers: {
      "List-Unsubscribe": `<${unsubscribeMailto}>, <${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  return { trackingToken: token };
}
