import nodemailer from "nodemailer";
import crypto from "crypto";
import { getDb } from "../config/db.js";

export class EmailCredentialsError extends Error {}

function buildTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new EmailCredentialsError(
      "Credenziali email non configurate nel file .env. Aggiungi EMAIL_USER e EMAIL_PASS (Password per le app di Google).",
    );
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

function trackingPixelTag(token) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `<img src="${baseUrl}/api/track/${token}" width="1" height="1" style="display:none" alt="" />`;
}

function registerTrackingToken(businessId) {
  const token = crypto.randomBytes(16).toString("hex");
  getDb()
    .prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)")
    .run(businessId, token);
  return token;
}

function textToHtml(text) {
  return text
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br>" : `<p style="margin: 0 0 8px 0;">${line}</p>`))
    .join("\n");
}

export async function sendOutreachEmail({ businessId, toEmail, subject, body }) {
  const transporter = buildTransporter();
  const token = registerTrackingToken(businessId);
  const html = `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
${textToHtml(body)}
${trackingPixelTag(token)}
</div>`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: subject || "Richiesta di contatto",
    text: body,
    html,
  });

  return { trackingToken: token };
}
