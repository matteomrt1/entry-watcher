## Obiettivo

Eliminare completamente `localStorage` come sorgente dati. L'unica sorgente di verità diventa il file fisico `database.json` letto/scritto dal server Node locale (`server.js`, porta 3001). Se il server non risponde, l'app si blocca con errore esplicito invece di degradare silenziosamente sul browser.

## Architettura finale

```text
┌────────────────────┐    HTTP (loopback)    ┌──────────────────────┐
│  Browser / Tablet  │ ───── GET /api/data ─►│  server.js (Node)    │
│  React (Vite dev   │ ◄──── JSON  ───────── │  Express minimale    │
│  o build statica)  │                       │  porta 3001          │
│                    │ ───── POST /api/data ►│                      │
└────────────────────┘                       │  legge/scrive        │
                                             │  ./database.json     │
                                             │  + backup giornalieri│
                                             └──────────────────────┘
```

- `database.json` vive nella root del progetto (stessa cartella di `package.json`).
- All'avvio l'app fa **solo** `GET /api/data`. Se fallisce → schermata di errore "Server locale non avviato", nessun fallback browser.
- Ogni mutazione (timbratura QR, manuale, CRUD dipendenti/progetti, assenze, riconciliazione, autofill) chiama `POST /api/data` **e attende la conferma** prima di considerare l'operazione completata.
- Backup automatici rotanti in `./backups/database-YYYY-MM-DD.json` (mantieni 7 giorni) per sicurezza.
- L'export JSON manuale dal `DataManager` resta come backup aggiuntivo scaricabile.

## Cosa cambia nel codice

### 1. `server.js` (root del progetto, nuovo / aggiornato)
Script Node puro (zero dipendenze npm, usa `node:http` + `node:fs`):
- `GET /api/data` → restituisce contenuto di `database.json` (crea file vuoto se assente).
- `POST /api/data` → valida JSON, scrittura atomica (`tmp` + `rename`), crea backup giornaliero.
- CORS aperto su `http://localhost:*` per il dev server Vite.
- Avvio: `node server.js` (oppure script npm dedicato).

### 2. `src/lib/attendance.ts` (refactor profondo)
- **Rimuovere**: `STORAGE_KEY`, `_hydrateFromLocal`, ogni `localStorage.getItem/setItem` collegato ai dati (mantengo `loadSettings/saveSettings` su localStorage perché sono preferenze UI, non dati di business — confermare con utente).
- `initData()` async: solo `fetch(GET)`. In caso di errore lancia eccezione → l'app mostra schermata di errore.
- `loadData()` resta sincrona ma legge solo dalla cache in memoria (idratata da `initData`).
- `saveData()` diventa **async** e attende la `POST`. Rimosso debounce di 200ms (ogni timbratura deve essere persistita subito; con un tablet la latenza loopback è < 5ms).
- Tutte le funzioni CRUD (`addEntry`, `updateEntry`, `deleteEntry`, `addEmployee`, `updateEmployee`, `deleteEmployee`, `addLeave`, `removeLeave`, `addProject`, `toggleProjectStatus`, `runReconciliation`, `runAutoFill`, `importJSON`) diventano `async` e fanno `await saveData(...)`.

### 3. Componenti consumer
Aggiornati per `await` le funzioni CRUD ora asincrone:
- `QRScanner.tsx`, `AttendanceLog.tsx`, `EmployeeManager.tsx`, `LeaveManager.tsx`, `ProjectManager.tsx`, `DataManager.tsx`, `ReviewPanel.tsx`, `Index.tsx` (boot).
- Stato di errore globale in `Index.tsx`: se `initData()` fallisce mostra una card "Server locale non in esecuzione" con istruzioni per avviarlo.

### 4. `package.json` (script di comodità)
Aggiungere:
- `"server": "node server.js"`
- `"start": "concurrently \"npm run server\" \"npm run dev\""` (richiede `concurrently` come devDep — opzionale, in alternativa istruzioni per due terminali).

### 5. Configurazione endpoint
- Variabile `VITE_API_BASE` già supportata (default `http://localhost:3001`). Documentata in `.env.example`.

## Migrazione del file fornito

Il `database.json` allegato (≈7260 righe) viene **copiato così com'è** nella root del progetto come stato iniziale. Al primo avvio il server lo legge e lo serve all'app.

## Istruzioni operative per l'utente

1. Posizionare `database.json` nella cartella root del progetto.
2. Aprire un terminale: `node server.js` → server attivo su `http://localhost:3001`.
3. In un secondo terminale: `npm run dev` (o, se aggiungiamo lo script combinato, solo `npm start`).
4. Aprire il tablet sul preview Vite. L'app legge/scrive su `database.json`.
5. Per la build di produzione locale: `npm run build` + un piccolo static server, sempre con `node server.js` in parallelo.

## Punti da confermare prima di implementare

1. **Settings UI** (`roundingMinutes`, `gracePeriodMinutes`): le sposto anche su `database.json` o restano su localStorage del browser? (Sono 2 numeri, non dati di business.)
2. **Comportamento se il server cade durante l'uso**: blocco l'azione con toast di errore e la respingo (nessuna scrittura locale di sicurezza)? Oppure metto in coda le operazioni e ritento?
3. **Scrittura intera vs incrementale**: ogni `POST` invia l'intero database (semplice, attuale). Va bene anche con i 7000+ record attuali, oppure preferisci endpoint granulari (`POST /api/entries`, ecc.) per ridurre il payload?

Una volta confermati questi tre punti procedo con l'implementazione.