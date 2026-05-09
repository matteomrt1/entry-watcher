## Problemi rilevati e soluzioni

### 1) Incongruenza ore Calendario vs Report

**Causa principale (in `src/lib/attendance.ts → calculateHours`):**
- Il filtro entries esclude tutte le timbrature con `requiresReview === true`. Le uscite auto-generate dalla riconciliazione hanno **sia** `isAutoFilled` **sia** `requiresReview` = true. Quindi:
  - Quando il Calendario richiede un singolo giorno con 1 check-in + 1 check-out auto, l'uscita viene scartata → 0h o "mezza giornata" risultante.
  - Il Report mostra invece il totale calcolato in modo diverso a seconda di quali giorni del periodo cadono nel filtro, da cui la discrepanza percepita ("8h" nel report).
- Inoltre c'è un mix incoerente di **timezone**: la chiave di raggruppamento usa `entry.timestamp.split('T')[0]` (UTC), mentre il filtro range usa `Date` locali (`dayStart/dayEnd`). Una timbratura a tarda sera può finire raggruppata in un giorno diverso da quello mostrato in UI.
- La detrazione pausa scatta su `dayEntries.length === 2`, ma se una delle due è auto-filled essa è già stata filtrata via, quindi la regola non si applica come previsto.

**Fix:**
- Includere le entries `requiresReview` nel calcolo ore (sono comunque pair valide), mantenendole evidenziate solo nella UI del Registro.
- Sostituire `entry.timestamp.split('T')[0]` con una `dateKey` calcolata in **timezone locale** (`toLocaleDateString('sv-SE')` o equivalente), allineando filtro range e raggruppamento.
- Centralizzare il calcolo per-giorno in una funzione unica (`computeDayHours(employee, dateStr)`) usata sia da `getDailyBreakdown` sia da `CalendarView.selectedDayHours` sia da `ReportView`, così lo stesso giorno ritorna sempre lo stesso valore.

### 2) Live Board incoerente

**Causa (in `src/components/LiveBoard.tsx`):**
- `isIn = last?.type === 'check-in'`. Una persona con turno spezzato che ha già fatto 4 timbrature (ultima = check-out) appare correttamente OUT, ma chi ha fatto solo l'ingresso del mattino e poi non ha più timbrato resta IN per sempre, anche dopo orario di uscita previsto.
- `roster` non include risorse che sono in **ferie/permesso/malattia** oggi: vengono mostrate come "OUT" generiche senza distinguere il motivo.
- L'orario "Atteso alle expectedIn1" ignora i turni `pomeriggio`/`notte` quando il `now` è già oltre la mezzanotte (turno notte).

**Fix:**
- Stato risorsa derivato in 3 valori: `IN`, `OUT`, `LEAVE` (ferie/permesso/malattia) con badge dedicato e colore distinto.
- `isIn` deve diventare falso anche se il numero di check-in dispari del giorno indica una sessione aperta ma è già passato l'`expectedOut2 + tolleranza` (configurabile, default 60 min) — in quel caso evidenziare come "Da chiudere" invece di IN attivo.
- KPI header: aggiungere conteggio "In ferie/permesso" separato da "Assenti".
- Ordinamento roster: prima IN attivi, poi LEAVE, poi OUT.

### 3) Registro a 2 mesi (≈60 giorni di default)

**Modifiche (in `src/components/AttendanceLog.tsx` + `src/pages/Index.tsx`):**
- Quando `showFilters` è attivo, precompilare `filterDateFrom` con `oggi - 60 giorni` e `filterDateTo` con `oggi`, così il registro mostra di default 2 mesi pieni.
- Aumentare `limit` a 500 nel tab "Registro" per non troncare 60gg di timbrature.
- Mantenere la possibilità di rimuovere/estendere il range manualmente con il pulsante "Resetta".

### 4) Finestra pausa pranzo configurabile per le 2-timbrature

**Modello (in `src/lib/attendance.ts`):**
- Aggiungere a `EmployeeProfile` due campi opzionali:
  - `lunchBreakStart?: string` (HH:MM)
  - `lunchBreakEnd?: string` (HH:MM)
- Mantenere il campo esistente `defaultBreakMinutes` come fallback.

**Logica (`calculateHours`):**
- Per i giorni con esattamente 2 timbrature (check-in + check-out) della risorsa:
  1. Se `lunchBreakStart`/`lunchBreakEnd` sono entrambi valorizzati → calcolare l'**intersezione** tra l'intervallo lavorato `[checkIn, checkOut]` e la finestra pausa `[lunchBreakStart, lunchBreakEnd]`, e sottrarre solo i minuti effettivamente sovrapposti (così se uno entra alle 14 la pausa pranzo 12-13 non viene detratta).
  2. Altrimenti, fallback a `defaultBreakMinutes`.

**UI (`src/components/EmployeeManager.tsx`):**
- Nel form aggiungere una sezione "Pausa pranzo automatica":
  - Due `Input type="time"` per inizio/fine pausa.
  - Testo informativo: "Detratta automaticamente nei giorni con sole 2 timbrature, solo per la porzione che cade nell'orario lavorato."
  - I campi convivono con `defaultBreakMinutes` (rinominato in UI come "Minuti fissi (fallback)").
- Nella lista profili mostrare l'eventuale finestra (`12:30–13:00`) accanto al turno.

## Dettagli tecnici

- Helper `localDateKey(iso: string): string` in `attendance.ts`, riusato in `calculateHours`, `getDailyBreakdown`, `runReconciliation` e `LiveBoard` per allineare i giorni.
- Funzione `overlapMinutes(aStart, aEnd, bStart, bEnd)` per calcolare l'intersezione pausa/lavoro.
- Aggiornare `getReviewEntries` resta invariato — il flag `requiresReview` continua a guidare la UI ma non più il calcolo ore.
- Nessuna migrazione dati richiesta: i nuovi campi sono opzionali, il vecchio `defaultBreakMinutes` resta valido come fallback.

## File coinvolti

- `src/lib/attendance.ts` — helper timezone, refactor `calculateHours`, nuovi campi `EmployeeProfile`, intersezione pausa.
- `src/components/CalendarView.tsx` — usare la stessa funzione per `selectedDayHours`.
- `src/components/ReportView.tsx` — invariato (beneficia del fix automaticamente).
- `src/components/LiveBoard.tsx` — stato a 3 valori, KPI, ordinamento, gestione sessione aperta.
- `src/components/AttendanceLog.tsx` — default 60 giorni quando `showFilters`.
- `src/pages/Index.tsx` — `limit={500}` nel tab Registro.
- `src/components/EmployeeManager.tsx` — nuovi campi finestra pausa pranzo.
