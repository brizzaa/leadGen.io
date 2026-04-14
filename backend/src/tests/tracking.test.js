import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import crypto from "crypto";

// Test diretto sulla logica DB del tracking senza avviare Express
describe("email_tracking DB logic", () => {
  let db;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE businesses (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE email_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        opened_at DATETIME,
        open_count INTEGER DEFAULT 0,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      );
      CREATE TABLE activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.prepare("INSERT INTO businesses (id, name) VALUES (1, 'Test Biz')").run();
  });

  afterEach(() => {
    db.close();
  });

  it("inserisce un token di tracking", () => {
    const token = crypto.randomBytes(16).toString("hex");
    db.prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)").run(1, token);

    const row = db.prepare("SELECT * FROM email_tracking WHERE token = ?").get(token);
    expect(row).toBeTruthy();
    expect(row.business_id).toBe(1);
    expect(row.open_count).toBe(0);
    expect(row.opened_at).toBeNull();
  });

  it("registra apertura email correttamente", () => {
    const token = crypto.randomBytes(16).toString("hex");
    db.prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)").run(1, token);

    // Simula apertura
    db.prepare(
      "UPDATE email_tracking SET opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP), open_count = open_count + 1 WHERE token = ?"
    ).run(token);

    const row = db.prepare("SELECT * FROM email_tracking WHERE token = ?").get(token);
    expect(row.open_count).toBe(1);
    expect(row.opened_at).toBeTruthy();
  });

  it("incrementa open_count su aperture multiple senza sovrascrivere opened_at", () => {
    const token = crypto.randomBytes(16).toString("hex");
    db.prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)").run(1, token);

    const updateStmt = db.prepare(
      "UPDATE email_tracking SET opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP), open_count = open_count + 1 WHERE token = ?"
    );

    updateStmt.run(token);
    const first = db.prepare("SELECT opened_at FROM email_tracking WHERE token = ?").get(token);

    updateStmt.run(token);
    updateStmt.run(token);

    const row = db.prepare("SELECT * FROM email_tracking WHERE token = ?").get(token);
    expect(row.open_count).toBe(3);
    expect(row.opened_at).toBe(first.opened_at); // Non sovrascritta
  });

  it("token duplicato lancia errore UNIQUE", () => {
    const token = crypto.randomBytes(16).toString("hex");
    db.prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)").run(1, token);

    expect(() => {
      db.prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)").run(1, token);
    }).toThrow();
  });

  it("calcola statistiche aggregate correttamente", () => {
    // 3 email inviate, 2 aperte
    for (let i = 0; i < 3; i++) {
      const token = crypto.randomBytes(16).toString("hex");
      db.prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)").run(1, token);
      if (i < 2) {
        db.prepare(
          "UPDATE email_tracking SET opened_at = CURRENT_TIMESTAMP, open_count = 1 WHERE token = ?"
        ).run(token);
      }
    }

    const stats = db.prepare("SELECT * FROM email_tracking WHERE business_id = ?").all(1);
    const totalSent = stats.length;
    const totalOpened = stats.filter((s) => s.opened_at).length;
    const openRate = Math.round((totalOpened / totalSent) * 100);

    expect(totalSent).toBe(3);
    expect(totalOpened).toBe(2);
    expect(openRate).toBe(67);
  });

  it("cascade delete rimuove tracking quando business eliminato", () => {
    const token = crypto.randomBytes(16).toString("hex");
    db.prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)").run(1, token);

    db.pragma("foreign_keys = ON");
    db.prepare("DELETE FROM businesses WHERE id = 1").run();

    const row = db.prepare("SELECT * FROM email_tracking WHERE token = ?").get(token);
    expect(row).toBeUndefined();
  });
});
