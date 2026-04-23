// Prima connessione: scansiona QR col telefono del numero dedicato.
// Sessione salvata in wa-auth/. Le run successive usano la sessione esistente.

import "dotenv/config";
import { getWASocket, closeSocket } from "../src/services/whatsappBaileys.js";

console.log("[WA] Avvio login...");
const sock = await getWASocket({ printQR: true });

// Invia un ping a te stesso per verificare
const myNum = process.env.MY_WHATSAPP?.replace(/[^0-9]/g, "");
if (myNum) {
  try {
    const jid = `${myNum.startsWith("39") ? myNum : "39" + myNum}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: "✓ Baileys connesso e funzionante." });
    console.log(`[WA] Ping inviato a ${myNum}`);
  } catch (e) {
    console.warn(`[WA] Ping fallito: ${e.message}`);
  }
}

console.log("[WA] Login completato. Sessione salvata in wa-auth/. Premi Ctrl+C.");
// Tieni aperto per permettere completamento handshake
await new Promise(r => setTimeout(r, 5000));
await closeSocket(sock);
process.exit(0);
