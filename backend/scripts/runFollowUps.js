// Processa follow-up scaduti. Schedula con cron (es. ogni ora):
//   0 * * * * cd /path/to/backend && node scripts/runFollowUps.js >> logs/followup.log 2>&1

import "dotenv/config";
import { processFollowUps } from "../src/services/followUpEngine.js";

const r = await processFollowUps();
console.log(`[${new Date().toISOString()}] ${JSON.stringify(r)}`);
process.exit(0);
