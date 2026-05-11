# Sistema Presenze — Persistenza su file fisico

Applicazione 100% offline per il monitoraggio presenze. **Nessun cloud, nessun localStorage**: tutti i dati vivono in `database.json` nella root del progetto.

## Architettura

```
┌────────────────────┐    HTTP loopback     ┌──────────────────────┐
│  Browser / Tablet  │ ── GET /api/data ──► │  server.js (Node)    │
│  React + Vite      │ ◄──── JSON ───────── │  porta 3001          │
│                    │ ── POST /api/data ─► │                      │
└────────────────────┘                      │  legge/scrive        │
                                            │  ./database.json     │
                                            │  + backups/ (7gg)    │
                                            └──────────────────────┘
```

- **Lettura**: all'avvio l'app fa `GET /api/data` UNA volta e popola la cache.
  Se il server non risponde l'app mostra una schermata di errore esplicita.
- **Scrittura**: ogni timbratura, modifica risorsa, assenza, ecc. esegue
  immediatamente `POST /api/data` (no debounce). Il server riscrive
  `database.json` in modo atomico (`tmp` + `rename`) e crea un backup
  giornaliero in `./backups/database-YYYY-MM-DD.json`.
- **Nessun localStorage** per i dati di business. Restano in localStorage solo
  le preferenze UI (`roundingMinutes`, `gracePeriodMinutes`).

## Requisiti

- Node.js ≥ 18 (per `node:fs/promises`, `import.meta`, fetch nativo).

## Avvio in locale (sviluppo)

```bash
# 1. Posiziona database.json nella root del progetto (se non esiste viene creato vuoto).

# 2. Installa le dipendenze
npm install

# 3a. Avvio combinato (server + Vite in un solo terminale)
npm start

# 3b. Oppure due terminali separati
npm run server   # terminale 1 → http://localhost:3001
npm run dev      # terminale 2 → http://localhost:8080
```

Apri il browser sulla URL stampata da Vite. L'app legge e scrive `database.json`.

## Avvio in produzione su tablet

```bash
npm run build           # genera dist/
npm run server          # avvia il backend
# poi servi dist/ con un qualunque static server (npx serve dist, nginx, ecc.)
```

Per l'app pubblicata, configura `VITE_API_BASE` se il server non è su `localhost:3001`.

## File chiave

| File | Scopo |
|---|---|
| `server.js` | Server Node (zero dipendenze npm) per leggere/scrivere `database.json` |
| `database.json` | **Unica sorgente di verità.** Va versionato/copiato a mano sul tablet |
| `backups/` | Backup giornalieri rotanti (ultimi 7 giorni) |
| `src/lib/attendance.ts` | Layer di accesso dati lato React |

## Backup manuale aggiuntivo

Dalla UI, il pulsante **Esporta JSON** in `DataManager` scarica una copia
istantanea dei dati come secondo livello di backup.

## Variabili d'ambiente

- `PORT` (server) — porta di ascolto (default `3001`)
- `DB_FILE` (server) — path al file database (default `./database.json`)
- `VITE_API_BASE` (frontend) — URL del server (default `http://localhost:3001`)

Vedi `.env.example`.
