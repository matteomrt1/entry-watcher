// ─────────────────────────────────────────────────────────────────────────────
// server.js — Server locale UNICO per persistenza + serving SPA.
//
// Avvio:    node server.js   (oppure: npm start = build + node server.js)
// Porta:    3001 (override con env PORT)
// File DB:  ./database.json (override con env DB_FILE)
// Backup:   ./backups/database-YYYY-MM-DD.json (rotazione 7 giorni)
//
// Architettura SINGLE-ORIGIN:
//   • GET  /api/health           → stato server
//   • GET  /api/data             → contenuto database.json
//   • POST /api/data             → riscrive database.json (atomico) + backup
//   • GET  /<asset>              → file statico da ./dist
//   • GET  /<route SPA>          → fallback su ./dist/index.html
//
// Sul tablet basta aprire:  http://<ip-del-pc>:3001/
// Niente CORS, niente proxy, niente IPv4 vs IPv6, niente Vite in produzione.
//
// Nessuna dipendenza npm: solo moduli core di Node.js (>= 18).
// ─────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT       = parseInt(process.env.PORT || '3001', 10);
const HOST       = process.env.HOST || '0.0.0.0';
const DB_FILE    = path.resolve(__dirname, process.env.DB_FILE || 'database.json');
const BACKUP_DIR = path.resolve(__dirname, 'backups');
const DIST_DIR   = path.resolve(__dirname, 'dist');
const BACKUP_DAYS = 7;

const EMPTY_DB = { entries: [], leaves: [], employees: [], projects: [] };

// ── Bootstrap ───────────────────────────────────────────────────────────────
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
  console.log(`[server] Creato database vuoto: ${DB_FILE}`);
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const distAvailable = fs.existsSync(path.join(DIST_DIR, 'index.html'));

// ── Helpers ─────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function rotateBackups() {
  try {
    const files = await fsp.readdir(BACKUP_DIR);
    const cutoff = Date.now() - BACKUP_DAYS * 24 * 60 * 60 * 1000;
    for (const f of files) {
      if (!f.startsWith('database-') || !f.endsWith('.json')) continue;
      const full = path.join(BACKUP_DIR, f);
      const stat = await fsp.stat(full);
      if (stat.mtimeMs < cutoff) await fsp.unlink(full);
    }
  } catch (err) {
    console.warn('[server] Pulizia backup fallita:', err.message);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function renameWithRetry(from, to) {
  let lastErr;
  for (let i = 0; i < 6; i++) {
    try {
      await fsp.rename(from, to);
      return;
    } catch (err) {
      lastErr = err;
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(err.code)) throw err;
      await wait(120 * (i + 1));
    }
  }
  throw lastErr;
}

async function writeAtomic(payload) {
  const tmp = DB_FILE + '.tmp';
  await fsp.writeFile(tmp, payload, 'utf8');
  try {
    await renameWithRetry(tmp, DB_FILE);
  } catch (err) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES', 'EBUSY'].includes(err.code)) {
      console.warn(`[server] Rename atomico bloccato da Windows (${err.code}); uso scrittura diretta su database.json`);
      await fsp.writeFile(DB_FILE, payload, 'utf8');
      await fsp.unlink(tmp).catch(() => undefined);
    } else {
      throw err;
    }
  }
  const backupFile = path.join(BACKUP_DIR, `database-${todayStr()}.json`);
  await fsp.writeFile(backupFile, payload, 'utf8');
  rotateBackups();
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(body);
}

function getLanUrls(port) {
  const urls = [];
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal) urls.push(`http://${net.address}:${port}/`);
    }
  }
  return urls;
}

function readBody(req, maxBytes = 50 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { reject(new Error('Payload troppo grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── Static serving (SPA) ────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
};

async function serveStatic(req, res) {
  if (!distAvailable) {
    return send(res, 503,
      `<!doctype html><meta charset="utf-8"><title>Build mancante</title>
       <body style="font-family:system-ui;padding:2rem;max-width:640px;margin:auto">
       <h1>⚠️ Cartella <code>dist/</code> non trovata</h1>
       <p>Esegui prima la build dell'app:</p>
       <pre style="background:#f4f4f4;padding:1rem;border-radius:6px">npm run build</pre>
       <p>Poi riavvia il server, oppure usa <code>npm start</code> che fa entrambi.</p>
       <p>In alternativa, in sviluppo apri Vite su <code>http://localhost:8080/</code>.</p>
       </body>`,
      'text/html; charset=utf-8'
    );
  }

  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  // Risolvi e proteggi da path traversal
  let filePath = path.join(DIST_DIR, urlPath);
  if (!filePath.startsWith(DIST_DIR)) {
    return send(res, 403, 'Forbidden', 'text/plain');
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    // Non esiste: SPA fallback su index.html (per route client-side)
    filePath = path.join(DIST_DIR, 'index.html');
  }

  try {
    const data = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const ct = MIME[ext] || 'application/octet-stream';
    const isHtml = ext === '.html';
    res.writeHead(200, {
      'Content-Type': ct,
      'Cache-Control': isHtml ? 'no-store' : 'public, max-age=3600',
    });
    res.end(data);
  } catch (err) {
    send(res, 500, `Errore lettura file: ${err.message}`, 'text/plain');
  }
}

// ── Router ──────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    if (req.url === '/api/health' && req.method === 'GET') {
      return send(res, 200, JSON.stringify({ ok: true, db: DB_FILE, distAvailable }));
    }

    if (req.url === '/api/data' && req.method === 'GET') {
      const raw = await fsp.readFile(DB_FILE, 'utf8');
      try { JSON.parse(raw); }
      catch {
        console.error('[server] database.json corrotto');
        return send(res, 500, JSON.stringify({ error: 'database.json corrotto' }));
      }
      return send(res, 200, raw);
    }

    if (req.url === '/api/data' && req.method === 'POST') {
      const body = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(body); }
      catch { return send(res, 400, JSON.stringify({ error: 'JSON non valido' })); }
      if (typeof parsed !== 'object' || parsed === null) {
        return send(res, 400, JSON.stringify({ error: 'Struttura non valida' }));
      }
      const safe = {
        entries:   Array.isArray(parsed.entries)   ? parsed.entries   : [],
        leaves:    Array.isArray(parsed.leaves)    ? parsed.leaves    : [],
        employees: Array.isArray(parsed.employees) ? parsed.employees : [],
        projects:  Array.isArray(parsed.projects)  ? parsed.projects  : [],
      };
      const payload = JSON.stringify(safe, null, 2);
      await writeAtomic(payload);
      return send(res, 200, JSON.stringify({ ok: true, saved: payload.length }));
    }

    // Endpoint API sconosciuto → 404 JSON (non SPA fallback!)
    if (req.url && req.url.startsWith('/api/')) {
      return send(res, 404, JSON.stringify({ error: 'Not found' }));
    }

    // Tutto il resto → SPA
    if (req.method === 'GET') return serveStatic(req, res);
    return send(res, 405, JSON.stringify({ error: 'Method not allowed' }));
  } catch (err) {
    console.error('[server] Errore:', err);
    const code = err?.code ? `Codice: ${err.code}. ` : '';
    const hint = err?.code === 'EACCES' || err?.code === 'EPERM' || err?.code === 'EBUSY'
      ? 'database.json potrebbe essere aperto/bloccato da Excel, editor, antivirus o permessi Windows. Chiudi il file e avvia il terminale come Amministratore.'
      : undefined;
    return send(res, 500, JSON.stringify({ error: `${code}${err.message || 'Errore interno'}`, hint }));
  }
});

server.listen(PORT, HOST, () => {
  const lanUrls = getLanUrls(PORT);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  📡 Presenze server attivo: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`     URL LAN rilevati: ${lanUrls.length ? lanUrls.join('  ') : 'nessun IPv4 LAN trovato'}`);
    console.log(`     Se l'URL LAN va in timeout: apri il firewall Windows sulla porta ${PORT}`);
  }
  console.log(`  💾 Database file: ${DB_FILE}`);
  console.log(`  🗂️  Backup dir:   ${BACKUP_DIR}`);
  console.log(`  🌐 SPA dist:     ${distAvailable ? DIST_DIR : '⚠️  non trovata (esegui: npm run build)'}`);
  console.log('═══════════════════════════════════════════════════════════');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[server] ERRORE: la porta ${PORT} è già occupata.`);
    console.error(`[server] Chiudi il vecchio processo Node oppure usa: set PORT=3002 && npm start\n`);
    process.exit(1);
  }
  if (err.code === 'EACCES') {
    console.error(`\n[server] ERRORE: permesso negato sulla porta ${PORT}. Avvia il terminale come amministratore o cambia porta.\n`);
    process.exit(1);
  }
  throw err;
});
