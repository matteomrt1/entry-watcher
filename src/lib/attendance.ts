// Types and storage utilities for attendance tracking

export interface AttendanceEntry {
  id: string;
  employeeName: string;
  timestamp: string; // ISO string
  type: 'check-in' | 'check-out';
}

export interface LeaveEntry {
  id: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  type: 'ferie' | 'permesso' | 'malattia' | 'altro';
  hours?: number; // for partial day (permesso)
  note?: string;
}

export interface AttendanceData {
  entries: AttendanceEntry[];
  leaves: LeaveEntry[];
}

const STORAGE_KEY = 'attendance_data';

export function loadData(): AttendanceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { entries: [], leaves: [] };
}

export function saveData(data: AttendanceData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function addEntry(entry: Omit<AttendanceEntry, 'id'>): AttendanceEntry {
  const data = loadData();
  const newEntry: AttendanceEntry = { ...entry, id: crypto.randomUUID() };
  data.entries.push(newEntry);
  saveData(data);
  return newEntry;
}

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

export function exportJSON(): string {
  return JSON.stringify(loadData(), null, 2);
}

export function importJSON(json: string): boolean {
  try {
    const data = JSON.parse(json) as AttendanceData;
    if (data.entries && data.leaves) {
      saveData(data);
      return true;
    }
  } catch {}
  return false;
}

// Get unique employee names
export function getEmployees(): string[] {
  const data = loadData();
  const names = new Set<string>();
  data.entries.forEach(e => names.add(e.employeeName));
  data.leaves.forEach(l => names.add(l.employeeName));
  return Array.from(names).sort();
}

// Determine last action for an employee (to auto-toggle check-in/out)
export function getLastAction(employeeName: string): AttendanceEntry | null {
  const data = loadData();
  const entries = data.entries
    .filter(e => e.employeeName === employeeName)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return entries[0] || null;
}

// Calculate work hours for a given date range
export function calculateHours(
  employeeName: string,
  startDate: Date,
  endDate: Date
): number {
  const data = loadData();
  const entries = data.entries
    .filter(e => e.employeeName === employeeName)
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

// Get daily breakdown for a date range
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

    days.push({
      date: dateStr,
      hours,
      leaveType: leave?.type,
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
}
