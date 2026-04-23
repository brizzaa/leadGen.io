import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = join(__dirname, "../../../wa-auth");
mkdirSync(AUTH_DIR, { recursive: true });

let currentSock = null;
let ready = false;

export async function getWASocket({ printQR = true } = {}) {
  if (currentSock && ready) return currentSock;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    browser: ["Ubuntu", "Chrome", "122.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  return new Promise((resolve, reject) => {
    let qrShown = false;
    sock.ev.on("connection.update", (u) => {
      const { connection, lastDisconnect, qr } = u;
      if (qr && printQR && !qrShown) {
        qrShown = true;
        console.log("\n[WA] Scansiona QR col telefono (WhatsApp → Dispositivi collegati):\n");
        qrcode.generate(qr, { small: true });
      }
      if (connection === "open") {
        console.log("[WA] Connessione aperta.");
        ready = true;
        currentSock = sock;
        resolve(sock);
      }
      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        console.log(`[WA] Connessione chiusa (code=${code}), reconnect=${shouldReconnect}`);
        ready = false;
        currentSock = null;
        if (!shouldReconnect) reject(new Error("Logged out — rilancia login"));
      }
    });
  });
}

export function toJid(phone) {
  // Normalizza: rimuove +, spazi, trattini. Assume IT (+39) se mancante.
  let n = String(phone || "").replace(/[^0-9]/g, "");
  if (!n) return null;
  if (n.startsWith("00")) n = n.slice(2);
  if (!n.startsWith("39") && n.length === 10 && n.startsWith("3")) n = "39" + n;
  return `${n}@s.whatsapp.net`;
}

export async function sendWhatsApp(sock, phone, text) {
  const jid = toJid(phone);
  if (!jid) throw new Error(`phone non valido: ${phone}`);
  const [exists] = await sock.onWhatsApp(jid);
  if (!exists?.exists) throw new Error(`numero non su WhatsApp: ${phone}`);
  return sock.sendMessage(exists.jid, { text });
}

export async function closeSocket(sock) {
  try { await sock?.end?.(undefined); } catch {}
  ready = false;
  currentSock = null;
}
