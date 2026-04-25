import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "../../../data/businesses.db");

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
        maps_scan_status TEXT,
        maps_scanned_at DATETIME,
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

      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'running',
        total INTEGER,
        sent INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS campaign_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER REFERENCES campaigns(id),
        business_id INTEGER REFERENCES businesses(id),
        status TEXT DEFAULT 'pending',
        landing_url TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(campaign_id, business_id)
      );
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        company TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS follow_ups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        step INTEGER NOT NULL DEFAULT 1,
        scheduled_at DATETIME NOT NULL,
        sent_at DATETIME,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS email_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        opened_at DATETIME,
        open_count INTEGER DEFAULT 0,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      );
    `);

    // Migration sicura: aggiunge vat_number ai DB già esistenti senza la colonna
    const cols = db.pragma("table_info(businesses)").map((c) => c.name);
    if (!cols.includes("vat_number")) {
      db.exec("ALTER TABLE businesses ADD COLUMN vat_number TEXT");
      console.log("[db] Migration: colonna vat_number aggiunta.");
    }
    if (!cols.includes("user_id")) {
      db.exec("ALTER TABLE businesses ADD COLUMN user_id INTEGER REFERENCES users(id)");
      console.log("[db] Migration: colonna user_id aggiunta a businesses.");
    }
    if (!cols.includes("country_code")) {
      db.exec("ALTER TABLE businesses ADD COLUMN country_code TEXT DEFAULT 'IT'");
      console.log("[db] Migration: colonna country_code aggiunta a businesses.");
    }
    if (!cols.includes("follow_ups_enabled")) {
      db.exec("ALTER TABLE businesses ADD COLUMN follow_ups_enabled INTEGER DEFAULT 0");
      console.log("[db] Migration: colonna follow_ups_enabled aggiunta a businesses.");
    }
    if (!cols.includes("email_source_url")) {
      db.exec("ALTER TABLE businesses ADD COLUMN email_source_url TEXT DEFAULT NULL");
      console.log("[db] Migration: colonna email_source_url aggiunta a businesses.");
    }

    // Migration: user_id su campaigns
    const campCols = db.pragma("table_info(campaigns)").map((c) => c.name);
    if (!campCols.includes("user_id")) {
      db.exec("ALTER TABLE campaigns ADD COLUMN user_id INTEGER REFERENCES users(id)");
      console.log("[db] Migration: colonna user_id aggiunta a campaigns.");
    }

    // Migration: user_id su groups
    const grpCols = db.pragma("table_info(groups)").map((c) => c.name);
    if (!grpCols.includes("user_id")) {
      db.exec("ALTER TABLE groups ADD COLUMN user_id INTEGER REFERENCES users(id)");
      console.log("[db] Migration: colonna user_id aggiunta a groups.");
    }

    // Migration: enrichment status columns
    if (!cols.includes("website_status")) {
      db.exec("ALTER TABLE businesses ADD COLUMN website_status TEXT DEFAULT NULL");
      console.log("[db] Migration: colonna website_status aggiunta.");
    }
    if (!cols.includes("contact_status")) {
      db.exec("ALTER TABLE businesses ADD COLUMN contact_status TEXT DEFAULT NULL");
      console.log("[db] Migration: colonna contact_status aggiunta.");
    }
    if (!cols.includes("enriched_at")) {
      db.exec("ALTER TABLE businesses ADD COLUMN enriched_at DATETIME DEFAULT NULL");
      console.log("[db] Migration: colonna enriched_at aggiunta.");
    }
  }
  return db;
}
