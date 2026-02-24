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
        is_blacklisted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, address)
      );

      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS business_groups (
        business_id INTEGER,
        group_id INTEGER,
        PRIMARY KEY (business_id, group_id),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );
    `);
  }
  return db;
}
