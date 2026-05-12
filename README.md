# Sistema Presenze — 100% offline, single-origin

App di monitoraggio presenze con persistenza su file fisico `database.json`.
**Un solo processo Node** serve sia le API sia l'interfaccia React buildata: niente cloud, niente localStorage per i dati di business, niente Vite in produzione, niente CORS.

## Architettura

```
┌────────────────────────┐
│  Tablet / Browser      │
│  http://<ip-pc>:3001/  │
└────────────┬───────────┘
             │ stesso origin → niente CORS, niente proxy
             ▼
┌────────────────────────────────────────────┐
│  server.js  (Node ≥18, zero dipendenze)    │
│  • GET  /api/data     → database.json      │
│  • POST /api/data     → scrive (atomico)   │
│  • GET  /<asset>      → ./dist (SPA)       │
│  • GET  /<route>      → ./dist/index.html  │
└────────────────────────────────────────────┘
                │
                ▼
        database.json + backups/*.json (7 giorni)
```

## Requisiti

- Node.js ≥ 18

## Avvio sul tablet aziendale (produzione)

```bash
npm install        # solo la prima volta
npm start          # builda l'app e avvia il server unico
```

Su Windows puoi usare direttamente:

```cmd
start-presenze-windows.cmd
```

Se lo esegui come **Amministratore**, lo script prova anche ad aprire automaticamente il firewall Windows sulla porta `3001`.

`npm start` esegue `vite build && node server.js`. Sul tablet apri:

```
http://<ip-del-pc>:3001/
```

Il server stampa in console gli URL LAN rilevati, ad esempio `http://192.168.1.216:3001/`. Se da tablet l'URL va in timeout ma `http://localhost:3001/` funziona sul PC, il problema è il firewall Windows: apri la porta **3001 TCP in ingresso** o avvia `start-presenze-windows.cmd` come Amministratore.

> **Nota**: apri SEMPRE l'app dall'URL del server (`:3001`). Se la apri dal sito Lovable pubblicato non potrà raggiungere il `database.json` locale.

## Sviluppo (con HMR di Vite)

In due terminali separati:

```bash
npm run server     # terminale 1 → http://localhost:3001
npm run dev        # terminale 2 → http://localhost:8080 (con HMR)
```

Oppure uno solo:

```bash
npm run dev:all    # concurrently: server + vite insieme
```

In sviluppo Vite ha un proxy `/api → 127.0.0.1:3001`, quindi anche aprendo `http://localhost:8080` le chiamate raggiungono il server di persistenza.

## File chiave

| File | Scopo |
|---|---|
| `server.js` | Server Node unico (API + static SPA) |
| `database.json` | **Unica sorgente di verità.** Da copiare a mano sul tablet |
| `backups/` | Backup giornalieri rotanti (ultimi 7 giorni) |
| `src/lib/attendance.ts` | Layer dati lato React (`fetch /api/data`) |
| `src/lib/uid.ts` | Generatore ID con fallback (per HTTP su IP di rete) |

## Backup manuale aggiuntivo

Dalla UI, **Esporta JSON** in `DataManager` scarica una copia istantanea come secondo livello di backup.

## Variabili d'ambiente

- `PORT` — porta del server (default `3001`)
- `HOST` — interfaccia di ascolto (default `0.0.0.0`, raggiungibile dalla LAN)
- `DB_FILE` — path al file database (default `./database.json`)

## Risoluzione problemi

**"Server OFFLINE" / errore `Unexpected token '<'`**
Hai aperto l'app da un origin diverso dal server (es. URL Lovable pubblicato).
→ Apri `http://<ip-pc>:3001/`.

**"crypto.randomUUID is not a function"**
Risolto: ora `src/lib/uid.ts` fornisce un fallback compatibile con HTTP su IP di rete.

**Porta 3001 occupata (`EADDRINUSE`)**
Un'istanza precedente è ancora in esecuzione. Su Windows:
```cmd
netstat -ano | findstr :3001
taskkill /PID <pid> /F
```
Oppure cambia porta: `set PORT=3002 && npm start`.

**`localhost:3001` funziona ma `http://192.168.x.x:3001/` va in timeout**
Il server è attivo, ma Windows blocca le connessioni dalla rete locale.
Apri PowerShell o Prompt come Amministratore nella cartella del progetto ed esegui:
```cmd
netsh advfirewall firewall add rule name="Presenze Offline 3001" dir=in action=allow protocol=TCP localport=3001
```
Poi riavvia `npm start` e apri l'URL LAN stampato dal server.
