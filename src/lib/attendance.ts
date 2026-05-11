// Types and storage utilities for attendance tracking

export type ShiftType = 'mattina' | 'pomeriggio' | 'notte' | 'spezzato' | 'personalizzato';

export const SHIFT_PRESETS: Record<Exclude<ShiftType, 'personalizzato'>, { label: string; expectedIn1: string; expectedOut1: string; expectedIn2: string; expectedOut2: string }> = {
  mattina:    { label: 'Mattina (06:00–14:00)',       expectedIn1: '06:00', expectedOut1: '14:00', expectedIn2: '', expectedOut2: '' },
  pomeriggio: { label: 'Pomeriggio (14:00–22:00)',    expectedIn1: '14:00', expectedOut1: '22:00', expectedIn2: '', expectedOut2: '' },
  notte:      { label: 'Notte (22:00–06:00)',         expectedIn1: '22:00', expectedOut1: '06:00', expectedIn2: '', expectedOut2: '' },
  spezzato:   { label: 'Spezzato (08:00–12:00 / 13:00–17:00)', expectedIn1: '08:00', expectedOut1: '12:00', expectedIn2: '13:00', expectedOut2: '17:00' },
};

export type TrackingMode = 'auto' | 'manual';

export interface EmployeeProfile {
  id: string;
  name: string;
  shift: ShiftType;
  /**
   * 'auto'   = camionisti / smart working: nessun QR. Auto-fill giornaliero
   * di 4 timbrature (in1/out1/in2/out2) basato sugli orari del turno.
   * 'manual' = dipendente standard: timbra con QR. Se nella giornata risultano
   * esattamente 2 timbrature viene applicata la detrazione pausa.
   */
  trackingMode: TrackingMode;
  expectedIn1: string;  // HH:MM
  expectedOut1: string;
  expectedIn2: string;
  expectedOut2: string;
  weeklyHours?: number; // default 40
  defaultBreakMinutes?: number; // detrazione pausa fissa (solo modo 'manual')
  lunchBreakStart?: string; // HH:MM (solo modo 'manual')
  lunchBreakEnd?: string;   // HH:MM (solo modo 'manual')
}

// ── Helpers timezone-safe ──

/** Restituisce la data in formato YYYY-MM-DD calcolata in timezone LOCALE. */
export function localDateKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Minuti di sovrapposizione tra due intervalli di Date (positivo o 0). */
export function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end <= start) return 0;
  return Math.round((end - start) / 60000);
}

// ── System Settings ──

export interface SystemSettings {
  roundingMinutes: number;   // 0, 5, 15, 30
  gracePeriodMinutes: number; // e.g. 10
}

const SETTINGS_KEY = 'attendance_settings';

export function loadSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { roundingMinutes: 15, gracePeriodMinutes: 10 };
}

export function saveSettings(settings: SystemSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ── Project Interface ──

export interface Project {
  id: string;
  name: string;
  client?: string;
  isActive: boolean;
}

export interface AttendanceEntry {
  id: string;
  employeeName: string;
  timestamp: string; // ISO string
  type: 'check-in' | 'check-out';
  isAutoFilled?: boolean;
  requiresReview?: boolean;
  projectId?: string;
  projectName?: string;
}

export interface LeaveEntry {
  id: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  type: 'ferie' | 'permesso' | 'malattia' | 'altro';
  hours?: number;
  note?: string;
}

export interface AttendanceData {
  entries: AttendanceEntry[];
  leaves: LeaveEntry[];
  employees: EmployeeProfile[];
  projects: Project[];
}

// ── Persistence layer ──
//
// Architettura 100% offline su file fisico:
//   1. Il server Node locale (server.js) gira su :3001 e legge/scrive
//      `database.json` nella root del progetto.
//   2. All'avvio l'app fa GET /api/data UNA volta e popola una cache in
//      memoria. Se la chiamata fallisce, `initData()` lancia un'eccezione e
//      l'UI mostra una schermata di errore (NESSUN fallback localStorage).
//   3. Ogni `saveData()` esegue immediatamente POST /api/data (no debounce).
//      In caso di errore l'utente viene notificato via toast e
//      `isServerAvailable()` diventa false.
//   4. localStorage NON è più sorgente di verità per i dati di business.

const emptyData = (): AttendanceData => ({ entries: [], leaves: [], employees: [], projects: [] });

let _cache: AttendanceData = emptyData();
let _initialized = false;
let _serverAvailable = false;
let _onSaveError: ((err: Error) => void) | null = null;

/** Registra un callback globale invocato quando una scrittura sul server fallisce. */
export function setSaveErrorHandler(fn: ((err: Error) => void) | null) {
  _onSaveError = fn;
}

/**
 * Idrata la cache leggendo dal server locale.
 * Da chiamare UNA VOLTA all'avvio dell'app (in Index.tsx).
 * In caso di errore lancia: l'app deve mostrare schermata "Server non in esecuzione".
 */
export async function initData(): Promise<AttendanceData> {
  const res = await fetch('/api/data', { cache: 'no-store' });
  if (!res.ok) {
    _serverAvailable = false;
    throw new Error(`Server ha risposto con status ${res.status}`);
  }
  const remote = (await res.json()) as Partial<AttendanceData>;
  _cache = {
    entries: remote.entries || [],
    leaves: remote.leaves || [],
    employees: remote.employees || [],
    projects: remote.projects || [],
  };
  _serverAvailable = true;
  _initialized = true;
  return _cache;
}

export function isServerAvailable(): boolean {
  return _serverAvailable;
}

export function isDataInitialized(): boolean {
  return _initialized;
}

export function loadData(): AttendanceData {
  return _cache;
}

/**
 * Aggiorna la cache in memoria e posta IMMEDIATAMENTE su database.json
 * tramite il server locale. Sincrona per non rompere l'interfaccia chiamante,
 * ma la POST viene avviata subito (no debounce). Errori → callback registrato.
 */
export function saveData(data: AttendanceData) {
  _cache = data;
  fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    keepalive: true,
  })
    .then(r => {
      if (!r.ok) {
        _serverAvailable = false;
        const err = new Error(`Server status ${r.status}`);
        _onSaveError?.(err);
      } else {
        _serverAvailable = true;
      }
    })
    .catch((err) => {
      _serverAvailable = false;
      _onSaveError?.(err instanceof Error ? err : new Error(String(err)));
    });
}

// ── Employee CRUD ──

export function addEmployee(profile: Omit<EmployeeProfile, 'id'>): EmployeeProfile {
  const data = loadData();
  const newProfile: EmployeeProfile = { ...profile, id: crypto.randomUUID() };
  data.employees.push(newProfile);
  saveData(data);
  return newProfile;
}

export function updateEmployee(id: string, updates: Partial<Omit<EmployeeProfile, 'id'>>): void {
  const data = loadData();
  const idx = data.employees.findIndex(e => e.id === id);
  if (idx >= 0) {
    data.employees[idx] = { ...data.employees[idx], ...updates };
    saveData(data);
  }
}

export function deleteEmployee(id: string): void {
  const data = loadData();
  data.employees = data.employees.filter(e => e.id !== id);
  saveData(data);
}

export function getEmployeesProfiles(): EmployeeProfile[] {
  return loadData().employees;
}

// ── Entry CRUD ──

export function addEntry(entry: Omit<AttendanceEntry, 'id'>): AttendanceEntry {
  const data = loadData();
  const newEntry: AttendanceEntry = { ...entry, id: crypto.randomUUID() };
  data.entries.push(newEntry);
  saveData(data);
  return newEntry;
}

export function updateEntry(id: string, updates: Partial<Omit<AttendanceEntry, 'id'>>): void {
  const data = loadData();
  const idx = data.entries.findIndex(e => e.id === id);
  if (idx >= 0) {
    data.entries[idx] = { ...data.entries[idx], ...updates };
    saveData(data);
  }
}

export function deleteEntry(id: string): void {
  const data = loadData();
  data.entries = data.entries.filter(e => e.id !== id);
  saveData(data);
}

// ── Leave CRUD ──

export function addLeave(leave: Omit<LeaveEntry, 'id'>): LeaveEntry {
  const data = loadData();
  const newLeave: LeaveEntry = { ...leave, id: crypto.randomUUID() };
  data.leaves.push(newLeave);
  saveData(data);
  return newLeave;
}

export function removeLeave(id: string) {
  const data = loadData();
  data.leaves = data.leaves.filter(l => l.id !== id);
  saveData(data);
}

// ── Export / Import ──

export function exportJSON(): string {
  return JSON.stringify(loadData(), null, 2);
}

export function importJSON(json: string): boolean {
  try {
    const data = JSON.parse(json) as AttendanceData;
    if (data.entries && data.leaves) {
      if (!data.employees) data.employees = [];
      if (!data.projects) data.projects = [];
      saveData(data);
      return true;
    }
  } catch {}
  return false;
}

// ── Query helpers ──

export function getEmployees(): string[] {
  const data = loadData();
  const names = new Set<string>();
  data.entries.forEach(e => names.add(e.employeeName));
  data.leaves.forEach(l => names.add(l.employeeName));
  data.employees.forEach(p => names.add(p.name));
  return Array.from(names).sort();
}

export function getLastAction(employeeName: string): AttendanceEntry | null {
  const data = loadData();
  const entries = data.entries
    .filter(e => e.employeeName === employeeName)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return entries[0] || null;
}

/** Count today's stamps for a given employee */
export function getTodayStampCount(employeeName: string): number {
  const data = loadData();
  const today = new Date().toISOString().split('T')[0];
  return data.entries.filter(
    e => e.employeeName === employeeName && e.timestamp.startsWith(today)
  ).length;
}

/** Get entries that need review */
export function getReviewEntries(): AttendanceEntry[] {
  const data = loadData();
  return data.entries.filter(e => e.requiresReview === true);
}

// ── Reconciliation Engine ──

export function runReconciliation(): number {
  const data = loadData();
  const today = new Date().toISOString().split('T')[0];
  let generated = 0;

  // Group entries by date (LOCALE) and employee (exclude today)
  const todayKey = localDateKey(new Date());
  const grouped: Record<string, Record<string, AttendanceEntry[]>> = {};
  for (const entry of data.entries) {
    const date = localDateKey(entry.timestamp);
    if (date >= todayKey) continue;
    if (!grouped[date]) grouped[date] = {};
    if (!grouped[date][entry.employeeName]) grouped[date][entry.employeeName] = [];
    grouped[date][entry.employeeName].push(entry);
  }

  for (const date of Object.keys(grouped)) {
    for (const empName of Object.keys(grouped[date])) {
      const dayEntries = grouped[date][empName];
      const count = dayEntries.length;

      // Already has auto-filled entries for this day? Skip to avoid duplicates
      if (dayEntries.some(e => e.isAutoFilled)) continue;

      // Only act on odd counts (1 or 3 = missing check-out)
      if (count === 0 || count === 2 || count === 4) continue;
      if (count % 2 === 0) continue;

      // Find employee profile
      const profile = data.employees.find(p => p.name === empName);
      // Le risorse 'auto' vengono gestite da runAutoFill, non dalla riconciliazione QR.
      if (profile?.trackingMode === 'auto') continue;
      const fallbackTime = profile?.expectedOut2 || profile?.expectedOut1 || '18:00';

      const autoEntry: AttendanceEntry = {
        id: crypto.randomUUID(),
        employeeName: empName,
        timestamp: `${date}T${fallbackTime}:00`,
        type: 'check-out',
        isAutoFilled: true,
        requiresReview: true,
      };
      data.entries.push(autoEntry);
      generated++;
    }
  }

  if (generated > 0) saveData(data);
  return generated;
}

// ── Auto-fill engine (modalità 'auto': camionisti / smart working) ──
//
// Per ogni risorsa con trackingMode === 'auto' garantisce 4 timbrature
// (in1/out1/in2/out2) per ogni giorno feriale dall'ultimo check fino a IERI
// incluso. Idempotente: salta i giorni con timbrature esistenti e i giorni
// con assenza registrata (ferie/permesso/malattia).
//
// Da chiamare all'avvio dell'app, dopo initData() e prima della
// renderizzazione dei tab.
export function runAutoFill(daysBack: number = 14): number {
  const data = loadData();
  const autos = data.employees.filter(p => p.trackingMode === 'auto');
  if (autos.length === 0) return 0;

  let generated = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const profile of autos) {
    // Set di date già popolate per questa risorsa (qualsiasi timbratura)
    const filledDays = new Set<string>();
    for (const e of data.entries) {
      if (e.employeeName === profile.name) filledDays.add(localDateKey(e.timestamp));
    }
    const leaveDays = new Set<string>();
    for (const l of data.leaves) {
      if (l.employeeName === profile.name) leaveDays.add(l.date);
    }

    for (let i = daysBack; i >= 1; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekend
      const dateStr = localDateKey(day);
      if (filledDays.has(dateStr) || leaveDays.has(dateStr)) continue;

      const slots: { time: string; type: 'check-in' | 'check-out' }[] = [];
      if (profile.expectedIn1)  slots.push({ time: profile.expectedIn1,  type: 'check-in'  });
      if (profile.expectedOut1) slots.push({ time: profile.expectedOut1, type: 'check-out' });
      if (profile.expectedIn2)  slots.push({ time: profile.expectedIn2,  type: 'check-in'  });
      if (profile.expectedOut2) slots.push({ time: profile.expectedOut2, type: 'check-out' });

      for (const s of slots) {
        data.entries.push({
          id: crypto.randomUUID(),
          employeeName: profile.name,
          timestamp: `${dateStr}T${s.time}:00`,
          type: s.type,
          isAutoFilled: true,
        });
        generated++;
      }
    }
  }

  if (generated > 0) saveData(data);
  return generated;
}

// ── Hours calculation ──

export function calculateHours(
  employeeName: string,
  startDate: Date,
  endDate: Date
): number {
  const data = loadData();
  const profile = data.employees.find(p => p.name === employeeName);
  // Detrazione pausa: solo per modalità 'manual' (i record 'auto' sono già completi).
  const isManual = (profile?.trackingMode ?? 'manual') === 'manual';
  const breakMinutes = isManual ? (profile?.defaultBreakMinutes ?? 0) : 0;
  const lunchStart = isManual ? profile?.lunchBreakStart : undefined;
  const lunchEnd = isManual ? profile?.lunchBreakEnd : undefined;

  // Includiamo anche le entries con requiresReview: rappresentano timbrature reali
  // (auto-filled) che vanno comunque conteggiate. Il flag guida solo la UI.
  const entries = data.entries
    .filter(e => e.employeeName === employeeName)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Group by LOCAL date to detect 2-stamp days for break deduction
  const byDate: Record<string, AttendanceEntry[]> = {};
  for (const entry of entries) {
    const ts = new Date(entry.timestamp);
    if (ts < startDate || ts > endDate) continue;
    const dateStr = localDateKey(entry.timestamp);
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(entry);
  }

  let totalMs = 0;

  for (const [dateStr, dayEntries] of Object.entries(byDate)) {
    let dayMs = 0;
    let lastCheckIn: Date | null = null;

    for (const entry of dayEntries) {
      const ts = new Date(entry.timestamp);
      if (entry.type === 'check-in') {
        lastCheckIn = ts;
      } else if (entry.type === 'check-out' && lastCheckIn) {
        dayMs += ts.getTime() - lastCheckIn.getTime();
        lastCheckIn = null;
      }
    }

    // 2 stamps (1 in + 1 out) → applica detrazione pausa pranzo
    if (dayEntries.length === 2) {
      const inEntry = dayEntries.find(e => e.type === 'check-in');
      const outEntry = dayEntries.find(e => e.type === 'check-out');
      if (inEntry && outEntry) {
        const inTs = new Date(inEntry.timestamp);
        const outTs = new Date(outEntry.timestamp);
        let deductMin = 0;

        if (lunchStart && lunchEnd) {
          // Costruisci finestra pausa nel giorno locale
          const [ls, lsm] = lunchStart.split(':').map(Number);
          const [le, lem] = lunchEnd.split(':').map(Number);
          const [y, mo, da] = dateStr.split('-').map(Number);
          const breakStart = new Date(y, mo - 1, da, ls, lsm, 0);
          const breakEnd = new Date(y, mo - 1, da, le, lem, 0);
          deductMin = overlapMinutes(inTs, outTs, breakStart, breakEnd);
        } else if (breakMinutes > 0) {
          deductMin = breakMinutes;
        }

        if (deductMin > 0) {
          dayMs -= deductMin * 60 * 1000;
          if (dayMs < 0) dayMs = 0;
        }
      }
    }

    totalMs += dayMs;
  }

  return Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;
}

export function getDailyBreakdown(
  employeeName: string,
  startDate: Date,
  endDate: Date
): { date: string; hours: number; leaveType?: string }[] {
  const days: { date: string; hours: number; leaveType?: string }[] = [];
  const data = loadData();
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = localDateKey(current);
    const dayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 0, 0, 0);
    const dayEnd = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 23, 59, 59);

    const hours = calculateHours(employeeName, dayStart, dayEnd);
    const leave = data.leaves.find(
      l => l.employeeName === employeeName && l.date === dateStr
    );

    days.push({ date: dateStr, hours, leaveType: leave?.type });
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function formatHours(h: number): string {
  const sign = h < 0 ? '- ' : '';
  const abs = Math.abs(h);
  const hrs = Math.floor(abs);
  const mins = Math.round((abs - hrs) * 60);
  return `${sign}${hrs}h ${mins.toString().padStart(2, '0')}m`;
}

// ── Tolerance & Rounding ──

export function applyTolerance(rawMinutes: number, settings: SystemSettings): number {
  // Grace period: if difference from a full hour block is within grace, snap to the block
  const { roundingMinutes, gracePeriodMinutes } = settings;

  // First apply grace period: if remainder < grace, floor it
  if (roundingMinutes > 0) {
    const remainder = rawMinutes % roundingMinutes;
    if (remainder > 0 && remainder <= gracePeriodMinutes) {
      // Abbuono: snap down
      return rawMinutes - remainder;
    }
    // Standard rounding to nearest step
    return Math.round(rawMinutes / roundingMinutes) * roundingMinutes;
  }

  // No rounding, just grace on full hours
  if (gracePeriodMinutes > 0) {
    const remainder = rawMinutes % 60;
    if (remainder > 0 && remainder <= gracePeriodMinutes) {
      return rawMinutes - remainder;
    }
  }

  return rawMinutes;
}

// ── Time Bank Calculation ──

export interface TimeBankResult {
  expectedHours: number;
  workedHours: number;
  balanceHours: number;
}

export function calculateTimeBank(
  employeeName: string,
  startDate: Date,
  endDate: Date
): TimeBankResult {
  const data = loadData();
  const settings = loadSettings();
  const profile = data.employees.find(p => p.name === employeeName);
  const weeklyHours = profile?.weeklyHours ?? 40;
  const dailyHours = weeklyHours / 5; // Mon-Fri

  // Count working days (exclude weekends)
  let workingDays = 0;
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      // Also exclude leave days
      const dateStr = cursor.toISOString().split('T')[0];
      const hasLeave = data.leaves.some(
        l => l.employeeName === employeeName && l.date === dateStr
      );
      if (!hasLeave) workingDays++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const expectedHours = Math.round(workingDays * dailyHours * 100) / 100;

  // Raw worked hours
  const rawHours = calculateHours(employeeName, startDate, endDate);
  const rawMinutes = rawHours * 60;

  // Apply tolerance
  const netMinutes = applyTolerance(rawMinutes, settings);
  const workedHours = Math.round((netMinutes / 60) * 100) / 100;

  return {
    expectedHours,
    workedHours,
    balanceHours: Math.round((workedHours - expectedHours) * 100) / 100,
  };
}

// ── Project CRUD ──

export function addProject(project: Omit<Project, 'id'>): Project {
  const data = loadData();
  const newProject: Project = { ...project, id: crypto.randomUUID() };
  data.projects.push(newProject);
  saveData(data);
  return newProject;
}

export function getProjects(): Project[] {
  return loadData().projects;
}

export function toggleProjectStatus(id: string): void {
  const data = loadData();
  const idx = data.projects.findIndex(p => p.id === id);
  if (idx >= 0) {
    data.projects[idx].isActive = !data.projects[idx].isActive;
    saveData(data);
  }
}

// ── Project Hours Calculation ──

export function calculateProjectHours(
  projectId: string | null,
  startDate: Date,
  endDate: Date
): { employeeName: string; hours: number }[] {
  const data = loadData();
  const entries = data.entries
    .filter(e => {
      const ts = new Date(e.timestamp);
      return ts >= startDate && ts <= endDate;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Group by employee
  const byEmployee: Record<string, AttendanceEntry[]> = {};
  for (const e of entries) {
    if (!byEmployee[e.employeeName]) byEmployee[e.employeeName] = [];
    byEmployee[e.employeeName].push(e);
  }

  const results: { employeeName: string; hours: number }[] = [];

  for (const [empName, empEntries] of Object.entries(byEmployee)) {
    let totalMs = 0;
    let lastCheckIn: { ts: Date; pId?: string } | null = null;

    for (const entry of empEntries) {
      const ts = new Date(entry.timestamp);
      if (entry.type === 'check-in') {
        lastCheckIn = { ts, pId: entry.projectId };
      } else if (entry.type === 'check-out' && lastCheckIn) {
        // Hours belong to the check-in's project
        const checkInProjectId = lastCheckIn.pId || null;
        if (checkInProjectId === projectId) {
          totalMs += ts.getTime() - lastCheckIn.ts.getTime();
        }
        lastCheckIn = null;
      }
    }

    const hours = Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;
    if (hours > 0) {
      results.push({ employeeName: empName, hours });
    }
  }

  return results;
}
