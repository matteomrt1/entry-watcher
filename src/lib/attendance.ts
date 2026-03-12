// Types and storage utilities for attendance tracking

export interface EmployeeProfile {
  id: string;
  name: string;
  expectedIn1: string;  // HH:MM
  expectedOut1: string;
  expectedIn2: string;
  expectedOut2: string;
  weeklyHours?: number; // default 40
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

const STORAGE_KEY = 'attendance_data';

export function loadData(): AttendanceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { entries: parsed.entries || [], leaves: parsed.leaves || [], employees: parsed.employees || [], projects: parsed.projects || [] };
    }
  } catch {}
  return { entries: [], leaves: [], employees: [], projects: [] };
}

export function saveData(data: AttendanceData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

  // Group entries by date and employee (exclude today)
  const grouped: Record<string, Record<string, AttendanceEntry[]>> = {};
  for (const entry of data.entries) {
    const date = entry.timestamp.split('T')[0];
    if (date >= today) continue;
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

      // Find employee profile for expectedOut2
      const profile = data.employees.find(p => p.name === empName);
      const fallbackTime = profile?.expectedOut2 || '18:00';

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

// ── Hours calculation ──

export function calculateHours(
  employeeName: string,
  startDate: Date,
  endDate: Date
): number {
  const data = loadData();
  const entries = data.entries
    .filter(e => e.employeeName === employeeName && !e.requiresReview)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let totalMs = 0;
  let lastCheckIn: Date | null = null;

  for (const entry of entries) {
    const ts = new Date(entry.timestamp);
    if (ts < startDate || ts > endDate) continue;

    if (entry.type === 'check-in') {
      lastCheckIn = ts;
    } else if (entry.type === 'check-out' && lastCheckIn) {
      totalMs += ts.getTime() - lastCheckIn.getTime();
      lastCheckIn = null;
    }
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
    const dateStr = current.toISOString().split('T')[0];
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayEnd = new Date(dateStr + 'T23:59:59');

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
