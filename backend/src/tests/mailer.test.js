import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: vi.fn(() => Promise.resolve()) })) },
}));
vi.mock("../config/db.js", () => ({
  getDb: () => ({ prepare: () => ({ run: vi.fn(), get: vi.fn(() => null) }) }),
}));
vi.mock("../emails/WebsitePreviewEmail.js", () => ({
  renderWebsitePreviewEmail: vi.fn(() => Promise.resolve("<html></html>")),
}));

describe("buildTransporter rotation", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.BREVO_SMTP_ACCOUNTS;
    process.env.BREVO_SMTP_USER = "single@brevo.com";
    process.env.BREVO_SMTP_KEY = "key";
    process.env.EMAIL_USER = "single@brevo.com";
  });

  it("usa account singolo quando BREVO_SMTP_ACCOUNTS non è impostato", async () => {
    const nodemailer = (await import("nodemailer")).default;
    nodemailer.createTransport.mockClear();
    const { sendOutreachEmail } = await import("../services/mailer.js");
    await sendOutreachEmail({ businessId: 1, toEmail: "x@x.it", subject: "S", body: "B", businessName: "X" }).catch(() => {});
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: expect.objectContaining({ user: "single@brevo.com" }) })
    );
  });

  it("ruota account per businessId % N quando BREVO_SMTP_ACCOUNTS è impostato", async () => {
    process.env.BREVO_SMTP_ACCOUNTS = JSON.stringify([
      { user: "acc0@brevo.com", pass: "p0", from: "Acc0 <acc0@leader-gen.com>" },
      { user: "acc1@brevo.com", pass: "p1", from: "Acc1 <acc1@leader-gen.com>" },
    ]);
    const nodemailer = (await import("nodemailer")).default;
    nodemailer.createTransport.mockClear();
    const { sendOutreachEmail } = await import("../services/mailer.js");

    // businessId=0 → index 0
    await sendOutreachEmail({ businessId: 0, toEmail: "a@x.it", subject: "S", body: "B", businessName: "X" }).catch(() => {});
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ auth: expect.objectContaining({ user: "acc0@brevo.com" }) })
    );

    // businessId=1 → index 1
    await sendOutreachEmail({ businessId: 1, toEmail: "b@x.it", subject: "S", body: "B", businessName: "X" }).catch(() => {});
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ auth: expect.objectContaining({ user: "acc1@brevo.com" }) })
    );
  });
});
