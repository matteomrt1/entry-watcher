import { useState, useMemo, useCallback } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { loadData, getEmployees, calculateHours, formatHours, addLeave, removeLeave, type LeaveEntry } from '@/lib/attendance';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Palmtree, Clock, Stethoscope, MoreHorizontal, Trash2, CalendarDays, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  refreshKey?: number;
  onUpdate?: () => void;
}

const leaveTypes = [
  { value: 'ferie', label: 'Ferie', icon: Palmtree, color: 'hsl(38, 92%, 50%)' },
  { value: 'permesso', label: 'Permesso', icon: Clock, color: 'hsl(220, 60%, 50%)' },
  { value: 'malattia', label: 'Malattia', icon: Stethoscope, color: 'hsl(0, 72%, 51%)' },
  { value: 'altro', label: 'Altro', icon: MoreHorizontal, color: 'hsl(220, 10%, 60%)' },
] as const;

const leaveColorMap: Record<string, string> = {
  ferie: 'bg-[hsl(38,92%,50%)]/20 text-[hsl(38,92%,35%)] border-[hsl(38,92%,50%)]/40',
  permesso: 'bg-[hsl(220,60%,50%)]/20 text-[hsl(220,60%,35%)] border-[hsl(220,60%,50%)]/40',
  malattia: 'bg-[hsl(0,72%,51%)]/20 text-[hsl(0,72%,40%)] border-[hsl(0,72%,51%)]/40',
  altro: 'bg-muted text-muted-foreground border-border',
};

function getWorkingDaysInMonth(year: number, month: number): number {
  let count = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export default function CalendarView({ refreshKey, onUpdate }: CalendarViewProps) {
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('__all__');
  const [leaveType, setLeaveType] = useState<LeaveEntry['type']>('ferie');
  const [hours, setHours] = useState('8');
  const [note, setNote] = useState('');

  const employees = useMemo(() => getEmployees(), [refreshKey]);
  const data = useMemo(() => loadData(), [refreshKey]);

  // Leaves for current month view
  const monthLeaves = useMemo(() => {
    const y = month.getFullYear();
    const m = String(month.getMonth() + 1).padStart(2, '0');
    const prefix = `${y}-${m}`;
    let filtered = data.leaves.filter(l => l.date.startsWith(prefix));
    if (selectedEmployee !== '__all__') {
      filtered = filtered.filter(l => l.employeeName === selectedEmployee);
    }
    return filtered;
  }, [data.leaves, month, selectedEmployee]);

  // Map date -> leaves
  const leavesByDate = useMemo(() => {
    const map: Record<string, LeaveEntry[]> = {};
    monthLeaves.forEach(l => {
      if (!map[l.date]) map[l.date] = [];
      map[l.date].push(l);
    });
    return map;
  }, [monthLeaves]);

  // Presence dates (days with actual check-in entries) for current month
  const presenceDates = useMemo(() => {
    const y = month.getFullYear();
    const m = String(month.getMonth() + 1).padStart(2, '0');
    const prefix = `${y}-${m}`;
    let entries = data.entries.filter(e => e.timestamp.startsWith(prefix) && e.type === 'check-in');
    if (selectedEmployee !== '__all__') {
      entries = entries.filter(e => e.employeeName === selectedEmployee);
    }
    const dates = new Set<string>();
    entries.forEach(e => dates.add(e.timestamp.split('T')[0]));
    return Array.from(dates).map(d => new Date(d + 'T00:00:00'));
  }, [data.entries, month, selectedEmployee]);

  // Hours worked per day for selected date
  const selectedDayHours = useMemo(() => {
    if (!selectedDate || selectedEmployee === '__all__') return null;
    const dateStr = selectedDate.toISOString().split('T')[0];
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayEnd = new Date(dateStr + 'T23:59:59');
    const hours = calculateHours(selectedEmployee, dayStart, dayEnd);
    return hours;
  }, [selectedDate, selectedEmployee, data.entries]);

  // Attendance percentage
  const attendanceStats = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const workingDays = getWorkingDaysInMonth(y, m);

    if (selectedEmployee === '__all__') {
      if (employees.length === 0) return { percentage: 100, workingDays, leaveDays: 0, presentDays: 0 };
      const totalSlots = workingDays * employees.length;
      const totalLeaveDays = monthLeaves.length;
      const presentSlots = totalSlots - totalLeaveDays;
      const pct = totalSlots > 0 ? Math.round((presentSlots / totalSlots) * 100) : 100;
      return { percentage: pct, workingDays, leaveDays: totalLeaveDays, presentDays: presentSlots };
    }

    const empLeaveDays = monthLeaves.filter(l => l.employeeName === selectedEmployee).length;
    const presentDays = workingDays - empLeaveDays;
    const pct = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 100;
    return { percentage: pct, workingDays, leaveDays: empLeaveDays, presentDays };
  }, [month, selectedEmployee, employees, monthLeaves]);

  // Days with leaves for calendar modifiers
  const leaveDates = useMemo(() => {
    return Object.keys(leavesByDate).map(d => new Date(d + 'T00:00:00'));
  }, [leavesByDate]);

  const handleAddLeave = useCallback(() => {
    if (!selectedDate) {
      toast.error('Seleziona una data dal calendario');
      return;
    }
    if (selectedEmployee === '__all__') {
      toast.error('Seleziona una risorsa specifica');
      return;
    }
    const dateStr = selectedDate.toISOString().split('T')[0];
    addLeave({
      employeeName: selectedEmployee,
      date: dateStr,
      type: leaveType,
      hours: leaveType === 'permesso' ? parseFloat(hours) : undefined,
      note: note.trim() || undefined,
    });
    toast.success(`${leaveTypes.find(t => t.value === leaveType)?.label} registrato`);
    setNote('');
    onUpdate?.();
  }, [selectedDate, selectedEmployee, leaveType, hours, note, onUpdate]);

  const handleDeleteLeave = useCallback((id: string) => {
    removeLeave(id);
    toast.success('Assenza rimossa');
    onUpdate?.();
  }, [onUpdate]);

  const selectedDateStr = selectedDate?.toISOString().split('T')[0];
  const selectedDayLeaves = selectedDateStr ? (leavesByDate[selectedDateStr] || []) : [];

  // Percentage color
  const pctColor = attendanceStats.percentage >= 80 ? 'text-accent' : attendanceStats.percentage >= 60 ? 'text-warning' : 'text-destructive';

  return (
    <div className="space-y-6">
      {/* Filter + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Risorsa</Label>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutte le risorse</SelectItem>
              {employees.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="stat-card text-center">
          <Percent className={cn("h-5 w-5 mx-auto mb-1", pctColor)} />
          <p className={cn("text-3xl font-bold font-mono", pctColor)}>{attendanceStats.percentage}%</p>
          <p className="text-xs text-muted-foreground">Presenze Mese</p>
        </div>

        <div className="stat-card text-center">
          <CalendarDays className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <div className="flex justify-center gap-4 text-sm">
            <div>
              <p className="text-lg font-bold font-mono text-accent">{attendanceStats.presentDays}</p>
              <p className="text-xs text-muted-foreground">Presenti</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-destructive">{attendanceStats.leaveDays}</p>
              <p className="text-xs text-muted-foreground">Assenze</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono">{attendanceStats.workingDays}</p>
              <p className="text-xs text-muted-foreground">Lavorativi</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="stat-card flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={month}
            onMonthChange={setMonth}
            className="p-3 pointer-events-auto"
            modifiers={{ leave: leaveDates, presence: presenceDates }}
            modifiersStyles={{
              leave: {
                backgroundColor: 'hsl(0, 72%, 51%, 0.15)',
                borderRadius: '50%',
                fontWeight: 600,
              },
              presence: {
                backgroundColor: 'hsl(155, 65%, 40%, 0.15)',
                borderRadius: '50%',
                fontWeight: 600,
              },
            }}
          />
          <div className="flex gap-4 justify-center mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(155, 65%, 40%, 0.4)' }} />
              Presente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(0, 72%, 51%, 0.4)' }} />
              Assenza
            </span>
          </div>
        </div>

        {/* Day detail + Add leave */}
        <div className="space-y-4">
          {selectedDate && (
            <>
              <div className="stat-card">
                <h3 className="font-semibold text-sm mb-3">
                  {selectedDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>

                {/* Ore lavorate */}
                {selectedDayHours !== null && selectedDayHours > 0 && (
                  <div className="flex items-center gap-2 mb-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <Clock className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Ore lavorate: <span className="font-mono">{formatHours(selectedDayHours)}</span></span>
                  </div>
                )}

                {selectedDayLeaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessuna assenza registrata</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayLeaves.map(leave => {
                      const lt = leaveTypes.find(t => t.value === leave.type);
                      const Icon = lt?.icon || MoreHorizontal;
                      return (
                        <div key={leave.id} className={cn("flex items-center gap-3 rounded-lg border p-3", leaveColorMap[leave.type])}>
                          <Icon className="h-4 w-4 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{leave.employeeName}</p>
                            <p className="text-xs opacity-75">
                              {lt?.label}{leave.hours ? ` · ${leave.hours}h` : ''}{leave.note ? ` · ${leave.note}` : ''}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteLeave(leave.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick add */}
              {selectedEmployee !== '__all__' && (
                <div className="stat-card space-y-3">
                  <h4 className="text-sm font-semibold">Aggiungi Assenza</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={leaveType} onValueChange={v => setLeaveType(v as LeaveEntry['type'])}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {leaveType === 'permesso' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Ore</Label>
                        <Input type="number" min="0.5" max="8" step="0.5" value={hours} onChange={e => setHours(e.target.value)} className="h-9" />
                      </div>
                    )}
                  </div>
                  <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note..." className="h-9" />
                  <Button onClick={handleAddLeave} size="sm" className="bg-accent hover:bg-accent/90 w-full">
                    Registra Assenza
                  </Button>
                </div>
              )}
            </>
          )}

          {!selectedDate && (
            <div className="stat-card text-center py-8">
              <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Seleziona un giorno dal calendario per vedere i dettagli</p>
            </div>
          )}
        </div>
      </div>

      {/* Monthly summary legend */}
      <div className="stat-card">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">Riepilogo Assenze del Mese</h3>
        {monthLeaves.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna assenza nel mese selezionato</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {leaveTypes.map(lt => {
              const count = monthLeaves.filter(l => l.type === lt.value).length;
              if (count === 0) return null;
              const Icon = lt.icon;
              return (
                <div key={lt.value} className={cn("rounded-lg border p-3 text-center", leaveColorMap[lt.value])}>
                  <Icon className="h-4 w-4 mx-auto mb-1" />
                  <p className="text-xl font-bold font-mono">{count}</p>
                  <p className="text-xs">{lt.label}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
