// ─────────────────────────────────────────────────────────────────────────────
// server.js — Server locale per persistenza presenze su file fisico.
//
// Avvio:    node server.js
// Porta:    3001 (override con env PORT)
// File:     ./database.json (override con env DB_FILE)
// Backup:   ./backups/database-YYYY-MM-DD.json (rotazione 7 giorni)
//
// Nessuna dipendenza npm: usa solo i moduli core di Node.js (>=18).
// CORS aperto su tutti gli origin di localhost (dev Vite + tablet locali).
// ─────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT      = parseInt(process.env.PORT || '3001', 10);
const DB_FILE   = path.resolve(__dirname, process.env.DB_FILE || 'database.json');
const BACKUP_DIR = path.resolve(__dirname, 'backups');
const BACKUP_DAYS = 7;

const EMPTY_DB = { entries: [], leaves: [], employees: [], projects: [] };

// ── Bootstrap: se database.json non esiste lo creiamo vuoto ─────────────────
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
  console.log(`[server] Creato database vuoto: ${DB_FILE}`);
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

async function writeAtomic(payload) {
  const tmp = DB_FILE + '.tmp';
  await fsp.writeFile(tmp, payload, 'utf8');
  await fsp.rename(tmp, DB_FILE);

  // Backup giornaliero (sovrascrive se già esiste oggi)
  const backupFile = path.join(BACKUP_DIR, `database-${todayStr()}.json`);
  await fsp.writeFile(backupFile, payload, 'utf8');
  rotateBackups();
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
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

// ── Router minimale ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  try {
    if (req.url === '/api/health' && req.method === 'GET') {
      return send(res, 200, JSON.stringify({ ok: true, db: DB_FILE }));
    }

    if (req.url === '/api/data' && req.method === 'GET') {
      const raw = await fsp.readFile(DB_FILE, 'utf8');
      // Validazione minima: deve essere JSON
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

      // Sanity check sulla forma
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

    return send(res, 404, JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('[server] Errore:', err);
    return send(res, 500, JSON.stringify({ error: err.message || 'Errore interno' }));
  }
});

// IL BLOCCO CRITICO CHE MANCAVA: Forzare 127.0.0.1
server.listen(PORT, '127.0.0.1', () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  📡 Presenze server attivo in LOCALE PURO: http://127.0.0.1:${PORT}`);
  console.log(`  💾 Database file: ${DB_FILE}`);
  console.log(`  🗂️  Backup dir:   ${BACKUP_DIR}`);
  console.log('═══════════════════════════════════════════════════════════');
});
