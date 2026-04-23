import { spawn } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import axios from "axios";

const GOSOM_BIN = join(process.env.HOME, "go/bin/google-maps-scraper");
const STREAM_POLL_MS = 10_000; // leggi nuove righe ogni 10s

async function geocodeCity(area) {
  try {
    const res = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: area + ", Italy", format: "json", limit: 1 },
      headers: { "User-Agent": "findbusiness-app/1.0 (local dev)" },
      timeout: 8000,
    });
    if (res.data?.length > 0) {
      const r = res.data[0];
      return { lat: parseFloat(r.lat), lon: parseFloat(r.lon) };
    }
  } catch { /* fallback */ }
  return null;
}

function getProxies() {
  const raw = process.env.GOSOM_PROXIES;
  return raw ? raw.split(",").map((p) => p.trim()).filter(Boolean) : [];
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const d = JSON.parse(trimmed);
    if (!d.title) return null;
    const email = Array.isArray(d.emails) && d.emails.length > 0 ? d.emails[0] : null;
    return {
      name: d.title ?? null,
      address: d.address ?? null,
      phone: d.phone ?? null,
      website: d.web_site || null,
      rating: d.review_rating ?? null,
      review_count: d.review_count ?? null,
      email,
      maps_url: d.link ?? null,
      is_claimed: true,
      facebook_url: null,
      instagram_url: null,
      social_last_active: null,
      latitude: d.latitude ?? null,
      longitude: d.longtitude ?? null, // gosom typo
    };
  } catch { return null; }
}

/**
 * Esegue gosom e chiama onBatch() ogni STREAM_POLL_MS con i nuovi business trovati.
 * Permette l'inserimento nel DB in streaming invece di aspettare la fine.
 */
function runGosom(queryFile, outputFile, { onProgress, onBatch, signal, geo, gridMode = false, bbox = null, gridCell = 1 }) {
  return new Promise((resolve, reject) => {
    const args = [
      "-input", queryFile,
      "-results", outputFile,
      "-json",
      "-depth", gridMode ? "3" : "10", // grid: depth basso, ogni cella è piccola
      "-c", "2",
      "-lang", "it",
      "-email",
    ];

    if (gridMode && bbox) {
      args.push("-grid-bbox", `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`);
      args.push("-grid-cell", String(gridCell));
    } else if (geo) {
      args.push("-geo", `${geo.lat},${geo.lon}`);
      args.push("-radius", "15000");
    }

    const proxies = getProxies();
    if (proxies.length > 0) args.push("-proxies", proxies.join(","));

    const proc = spawn(GOSOM_BIN, args, { stdio: ["ignore", "ignore", "pipe"] });

    let totalFound = 0;
    let queriesDone = 0;
    let linesRead = 0; // quante righe del file abbiamo già processato

    // Polling: legge le righe nuove scritte da gosom nel file di output
    const pollInterval = setInterval(() => {
      if (!existsSync(outputFile)) return;
      try {
        const allLines = readFileSync(outputFile, "utf8").split("\n");
        const newLines = allLines.slice(linesRead);
        linesRead = allLines.length;

        const batch = newLines.map(parseLine).filter(Boolean);
        if (batch.length > 0) onBatch(batch);
      } catch { /* file ancora in scrittura, skip */ }
    }, STREAM_POLL_MS);

    proc.stderr.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        if (line.includes("places found")) {
          const match = line.match(/(\d+) places found/);
          if (match) {
            totalFound += parseInt(match[1], 10);
            onProgress(`📍 ${totalFound} trovati finora...`);
          }
        } else if (line.includes("job finished")) {
          queriesDone++;
          onProgress(`✅ Query ${queriesDone} completata — ${totalFound} trovati`);
        } else if (line.includes("ERROR") || line.includes("error")) {
          onProgress(`⚠️ ${line.trim()}`);
        }
      }
    });

    const checkAbort = setInterval(() => {
      if (signal.aborted) { proc.kill("SIGTERM"); clearInterval(checkAbort); }
    }, 500);

    proc.on("close", (code) => {
      clearInterval(checkAbort);
      clearInterval(pollInterval);

      // Flush finale: legge le righe rimaste dopo l'ultimo poll
      if (existsSync(outputFile)) {
        try {
          const allLines = readFileSync(outputFile, "utf8").split("\n");
          const remaining = allLines.slice(linesRead).map(parseLine).filter(Boolean);
          if (remaining.length > 0) onBatch(remaining);
        } catch { /* skip */ }
      }

      if (signal.aborted) return resolve();
      if (code !== 0 && code !== null) reject(new Error(`gosom exited with code ${code}`));
      else resolve();
    });

    proc.on("error", reject);
  });
}

// Calcola bbox quadrata intorno a un punto dato raggio in km
function cityBbox(lat, lon, radiusKm) {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  return {
    minLat: lat - dLat, maxLat: lat + dLat,
    minLon: lon - dLon, maxLon: lon + dLon,
  };
}

export async function scrapeBusinesses(
  area,
  category,
  onProgress = () => {},
  signal = { aborted: false },
  onBatch = () => {},
) {
  const ALL_CATEGORIES = [
    // cibo & bevande
    "ristorante","pizzeria","bar","trattoria","osteria","enoteca","gelateria",
    "piadineria","rosticceria","kebab","sushi","gastronomia","macelleria",
    "pescheria","fruttivendolo","caffetteria","wine bar","birrificio","cantina",
    "pasticceria","panificio","bakery","fast food",
    // salute & benessere
    "dentista","medico","farmacia","fisioterapista","psicologo","veterinario",
    "laboratorio analisi","nutrizionista","pediatra","cardiologo","ortopedico",
    "dermatologo","ginecologo","oculista","logopedista","clinica","ambulatorio",
    "centro medico","studio medico",
    // estetica & wellness
    "parrucchiere","centro estetico","palestra","barbiere","spa","centro massaggi",
    "nail salon","solarium","centro benessere","yoga","pilates","crossfit",
    "arti marziali","danza","piscina",
    // automotive
    "meccanico","carrozzeria","gommista","autolavaggio","officina","elettrauto",
    "concessionaria auto","autonoleggio","stazione di servizio",
    // servizi professionali
    "studio legale","commercialista","notaio","architetto","geometra",
    "agenzia immobiliare","assicurazioni","agenzia di viaggio","consulente del lavoro",
    "studio fotografico","agenzia pubblicitaria","web agency","banca","consulenza informatica",
    // casa & artigianato
    "idraulico","elettricista","falegname","imbianchino","giardiniere","muratore",
    "fabbro","impresa di pulizie","traslochi","serramentista","tappezziere",
    "arredamento","cucine","infissi","pavimenti","ceramiche","tende",
    // retail
    "hotel","negozio abbigliamento","supermercato","tabaccheria","gioielleria",
    "ottico","libreria","cartoleria","ferramenta","elettronica","calzature",
    "profumeria","casalinghi","elettrodomestici","mobili","pet shop","fiori",
    "sport","informatica","telefonia","abbigliamento bambini","orologeria",
    "antiquariato","merceria","cosmetica","illuminazione","bricolage","edicola",
    // formazione & intrattenimento
    "scuola guida","scuola di lingue","musica","scuola di cucina",
    "campo da tennis","circolo sportivo","bowling","maneggio","cinema","teatro",
    // altri servizi
    "bed and breakfast","agriturismo","affittacamere",
    "lavanderia","sartoria","calzolaio","riparazione telefoni","centro stampa",
    "tipografia","pompe funebri","noleggio","toelettatura cani",
    "fotografo","parafarmacia","erboristeria","ottica","centro scommesse",
  ];

  const isGridScan = category === "__grid__";
  const isAll = category === "attività" || category === "__all__";

  onProgress("🌍 Risoluzione coordinate...");
  const geo = await geocodeCity(area);
  if (geo) onProgress(`📌 Coordinate: ${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}`);

  const id = randomUUID();
  const queryFile = join(tmpdir(), `gosom-query-${id}.txt`);
  const outputFile = join(tmpdir(), `gosom-out-${id}.json`);

  let gosomOpts = { onProgress, onBatch, signal, geo };

  try {
    if (isGridScan) {
      // Scan completo: griglia da 250m su 10km di raggio → massima copertura
      if (!geo) throw new Error("Impossibile geolocalizzare l'area per lo scan completo.");
      const CELL_KM = 0.25;
      const RADIUS_KM = 10;
      const bbox = cityBbox(geo.lat, geo.lon, RADIUS_KM);
      const cellCount = Math.ceil((bbox.maxLat - bbox.minLat) / (CELL_KM / 111)) *
                        Math.ceil((bbox.maxLon - bbox.minLon) / (CELL_KM / (111 * Math.cos(geo.lat * Math.PI / 180))));
      onProgress(`🗺️ Scan completo — griglia ${cellCount} celle da 250m su ${RADIUS_KM}km di raggio`);
      onProgress(`⏱️ Stima: ${Math.ceil(cellCount * 3 / 60)} min (2 worker, ~3s/cella)`);
      writeFileSync(queryFile, "attività\n", "utf8");
      gosomOpts = { ...gosomOpts, gridMode: true, bbox, gridCell: CELL_KM };
    } else {
      const queries = isAll
        ? ALL_CATEGORIES.map((c) => `${c} ${area}`)
        : [`${category} ${area}`];
      onProgress(`🔍 ${isAll ? `${queries.length} categorie` : `"${queries[0]}"`} in ${area}`);
      writeFileSync(queryFile, queries.join("\n") + "\n", "utf8");
    }

    onProgress("🤖 Avvio gosom — inserimento in streaming ogni 10s...");
    await runGosom(queryFile, outputFile, gosomOpts);

    if (signal.aborted) onProgress("🛑 Scraping interrotto dall'utente.");
  } finally {
    try { unlinkSync(queryFile); } catch { /* skip */ }
    try { unlinkSync(outputFile); } catch { /* skip */ }
  }
}
