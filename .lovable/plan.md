## Obiettivo
Eliminare alla radice il problema "Server OFFLINE" rendendo l'app **single-origin**: un solo processo Node serve sia le API (`/api/data`) sia i file statici dell'app buildata. Niente Vite in produzione, niente proxy, niente conflitti IPv4/IPv6, niente CORS.

## Cause del problema attuale
1. **Origin diverso**: quando il tablet apre l'URL pubblicato Lovable (o un host diverso da `localhost:8080`), `fetch('/api/data')` colpisce quel server, non `127.0.0.1:3001`. Riceve `index.html` → errore `Unexpected token '<'`.
2. **Due processi accoppiati**: Vite (8080) + Node (3001) richiedono il proxy attivo. Una porta occupata o un crash → tutto rotto.
3. **`crypto.randomUUID`**: richiede HTTPS o `localhost`. Su IP di rete (`192.168.x.x`) in HTTP fallisce. Va sostituito con un fallback robusto **una volta sola**, in un helper centrale.

## Architettura target

```text
                      ┌─────────────────────────────────┐
   Tablet/Browser ──► │  server.js  (porta 3001)        │
                      │  • GET /api/data  → database.json│
                      │  • POST /api/data → scrive file  │
                      │  • GET /*  → serve dist/ (SPA)   │
                      └─────────────────────────────────┘
                                    │
                                    ▼
                              database.json
                              backups/*.json
```

Un solo URL da aprire sul tablet: `http://<ip-pc>:3001/`. Stesso origin per app e API → `fetch('/api/data')` funziona sempre.

## Modifiche

### 1. `server.js` — diventa anche static file server
- Aggiungere serving della cartella `dist/` con corretto `Content-Type` per `.js / .css / .html / .svg / .png / .ico / .woff2`.
- SPA fallback: qualunque GET non-API e senza estensione → restituisce `dist/index.html`.
- Mantenere `/api/health`, `/api/data` GET/POST, scrittura atomica e backup giornalieri.
- Continuare ad ascoltare su `0.0.0.0` (così il tablet sulla rete locale può connettersi), non solo `127.0.0.1`.

### 2. `src/lib/uid.ts` (nuovo)
- Helper `newId()` che usa `crypto.randomUUID()` se disponibile, altrimenti fallback `crypto.getRandomValues` + timestamp. Sostituire tutte le occorrenze di `crypto.randomUUID()` nel codice con `newId()`.

### 3. `src/lib/attendance.ts`
- Lasciare `fetch('/api/data')` relativo (già corretto): in single-origin non serve `VITE_API_BASE`.
- Rendere `VITE_API_BASE` opzionale con default `''` (relative).
- Sostituire `crypto.randomUUID()` con `newId()`.

### 4. `package.json` — script semplificati
```json
{
  "scripts": {
    "dev":   "vite",                          // solo per sviluppo Lovable
    "server": "node server.js",
    "build": "vite build",
    "start": "npm run build && node server.js" // produzione tablet: un solo comando
  }
}
```
Rimuovere `concurrently` (non più necessario in produzione). Resta utile solo se si vuole sviluppare con HMR contemporaneamente al server: in quel caso usare `npm run dev` + `npm run server` in due terminali, il proxy Vite verso 3001 resta nel `vite.config.ts`.

### 5. `vite.config.ts`
- Mantenere il proxy `/api → 127.0.0.1:3001` per lo sviluppo HMR. Nessuna modifica.

### 6. `README.md`
Aggiornare la sezione "Avvio sul tablet":
```bash
npm install
npm start                # builda e avvia il server unico
# poi sul tablet apri:  http://<ip-del-pc>:3001/
```
Per sapere l'IP del PC: `ipconfig` (Windows) → cerca "IPv4". Aprire la porta 3001 sul firewall Windows se richiesto.

## Cosa NON cambia
- Logica di business (timbrature, calcoli ore, riconciliazione, autofill).
- Schema `database.json`.
- UI e componenti React.
- Backup giornalieri rotanti.
- Pulsante "Esporta JSON" come backup manuale.

## Risultato
- Un solo processo, un solo URL, un solo origin.
- Niente più `Failed to fetch`, niente `Unexpected token '<'`, niente `crypto.randomUUID is not a function`.
- Il tablet apre `http://<ip-pc>:3001/` e funziona anche se il PC viene riavviato (basta ri-eseguire `npm start`, oppure registrare il comando come servizio Windows in un secondo momento).
