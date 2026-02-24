import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "../../data/businesses.db");

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        website TEXT,
        rating REAL,
        review_count INTEGER,
        email TEXT,
        category TEXT,
        area TEXT,
        maps_url TEXT,
        status TEXT DEFAULT 'Da Contattare',
        is_claimed INTEGER DEFAULT 1,
        notes TEXT,
        next_contact DATETIME,
        facebook_url TEXT,
        instagram_url TEXT,
        social_last_active TEXT,
        last_social_scan_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, address)
      );
    `);

    // Auto-migration for existing DBs
    try {
      db.exec(
        "ALTER TABLE businesses ADD COLUMN status TEXT DEFAULT 'Da Contattare'",
      );
    } catch (e) {
      // Ignored if column already exists
    }

    try {
      db.exec("ALTER TABLE businesses ADD COLUMN is_claimed INTEGER DEFAULT 1");
    } catch (e) {
      // Ignored
    }

    try {
      db.exec("ALTER TABLE businesses ADD COLUMN notes TEXT");
    } catch (e) {
      // Ignored
    }

    try {
      db.exec("ALTER TABLE businesses ADD COLUMN next_contact DATETIME");
    } catch (e) {
      // Ignored
    }

    try {
      db.exec("ALTER TABLE businesses ADD COLUMN facebook_url TEXT");
    } catch (e) {
      // Ignored
    }

    try {
      db.exec("ALTER TABLE businesses ADD COLUMN instagram_url TEXT");
    } catch (e) {
      // Ignored
    }

    try {
      db.exec("ALTER TABLE businesses ADD COLUMN social_last_active TEXT");
    } catch (e) {
      // Ignored
    }

    try {
      db.exec("ALTER TABLE businesses ADD COLUMN last_social_scan_at DATETIME");
    } catch (e) {
      // Ignored
    }

    try {
      db.exec(
        "ALTER TABLE businesses ADD COLUMN is_blacklisted INTEGER DEFAULT 0",
      );
    } catch (e) {
      // Ignored
    }
  }
  return db;
}
