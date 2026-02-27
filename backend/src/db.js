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
        vat_number TEXT,
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

      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        meta TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS business_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      );
    `);

    // Migration sicura: aggiunge vat_number ai DB già esistenti senza la colonna
    const cols = db.pragma("table_info(businesses)").map((c) => c.name);
    if (!cols.includes("vat_number")) {
      db.exec("ALTER TABLE businesses ADD COLUMN vat_number TEXT");
      console.log("[db] Migration: colonna vat_number aggiunta.");
    }
  }
  return db;
}
