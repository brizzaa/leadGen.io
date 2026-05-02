import { getDb } from "../src/config/db.js";

const db = getDb();
const result = db.prepare(
  "UPDATE follow_ups SET status = 'cancelled' WHERE step > 1 AND status = 'pending'"
).run();
console.log(`Cancelled ${result.changes} stale follow-ups (step > 1)`);
process.exit(0);
