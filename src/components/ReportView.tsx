import { useState, useMemo } from 'react';
import { getEmployees, calculateHours, getDailyBreakdown, formatHours, loadData } from '@/lib/attendance';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { BarChart3, Calendar, Clock, User } from 'lucide-react';

type Period = 'day' | 'week' | 'month' | 'year';

interface ReportViewProps {
  refreshKey?: number;
}

export default function ReportView({ refreshKey }: ReportViewProps) {
  const employees = useMemo(() => getEmployees(), [refreshKey]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [period, setPeriod] = useState<Period>('month');
  const [refDate, setRefDate] = useState(new Date().toISOString().split('T')[0]);

  const { startDate, endDate } = useMemo(() => {
    const ref = new Date(refDate + 'T00:00:00');
    let start: Date, end: Date;

    switch (period) {
      case 'day':
        start = new Date(ref);
        end = new Date(ref);
        end.setHours(23, 59, 59);
        break;
      case 'week': {
        const day = ref.getDay();
        const diff = day === 0 ? 6 : day - 1; // Monday start
        start = new Date(ref);
        start.setDate(ref.getDate() - diff);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59);
        break;
      }
      case 'month':
        start = new Date(ref.getFullYear(), ref.getMonth(), 1);
        end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'year':
        start = new Date(ref.getFullYear(), 0, 1);
        end = new Date(ref.getFullYear(), 11, 31, 23, 59, 59);
        break;
    }
    return { startDate: start!, endDate: end! };
  }, [period, refDate]);

  const totalHours = useMemo(() => {
    if (!selectedEmployee) return 0;
    return calculateHours(selectedEmployee, startDate, endDate);
  }, [selectedEmployee, startDate, endDate, refreshKey]);

  const breakdown = useMemo(() => {
    if (!selectedEmployee || period === 'year') return [];
    return getDailyBreakdown(selectedEmployee, startDate, endDate);
  }, [selectedEmployee, startDate, endDate, period, refreshKey]);

  const leaveCount = useMemo(() => {
    if (!selectedEmployee) return { ferie: 0, permesso: 0, malattia: 0, altro: 0 };
    const data = loadData();
    const leaves = data.leaves.filter(
      l => l.employeeName === selectedEmployee && l.date >= startDate.toISOString().split('T')[0] && l.date <= endDate.toISOString().split('T')[0]
    );
    return {
      ferie: leaves.filter(l => l.type === 'ferie').length,
      permesso: leaves.filter(l => l.type === 'permesso').length,
      malattia: leaves.filter(l => l.type === 'malattia').length,
      altro: leaves.filter(l => l.type === 'altro').length,
    };
  }, [selectedEmployee, startDate, endDate, refreshKey]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="stat-card">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-accent" />
          Report Ore Lavorate
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Risorsa</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona risorsa" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Periodo</Label>
            <Select value={period} onValueChange={v => setPeriod(v as Period)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Giorno</SelectItem>
                <SelectItem value="week">Settimana</SelectItem>
                <SelectItem value="month">Mese</SelectItem>
                <SelectItem value="year">Anno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data di riferimento</Label>
            <Input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} />
          </div>
        </div>
      </div>

      {selectedEmployee && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="stat-card text-center">
              <Clock className="h-5 w-5 text-accent mx-auto mb-1" />
              <p className="text-2xl font-bold font-mono">{formatHours(totalHours)}</p>
              <p className="text-xs text-muted-foreground">Ore Lavorate</p>
            </div>
            <div className="stat-card text-center">
              <Calendar className="h-5 w-5 text-warning mx-auto mb-1" />
              <p className="text-2xl font-bold font-mono">{leaveCount.ferie}</p>
              <p className="text-xs text-muted-foreground">Giorni Ferie</p>
            </div>
            <div className="stat-card text-center">
              <Clock className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-2xl font-bold font-mono">{leaveCount.permesso}</p>
              <p className="text-xs text-muted-foreground">Permessi</p>
            </div>
            <div className="stat-card text-center">
              <User className="h-5 w-5 text-destructive mx-auto mb-1" />
              <p className="text-2xl font-bold font-mono">{leaveCount.malattia}</p>
              <p className="text-xs text-muted-foreground">Malattia</p>
            </div>
          </div>

          {/* Daily breakdown */}
          {breakdown.length > 0 && period !== 'year' && (
            <div className="stat-card">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                Dettaglio Giornaliero
              </h4>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {breakdown.map(day => {
                  const weekday = new Date(day.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short' });
                  const isWeekend = ['sab', 'dom'].includes(weekday.toLowerCase().slice(0, 3));
                  const maxHours = 10;
                  const barWidth = Math.min((day.hours / maxHours) * 100, 100);

                  return (
                    <div
                      key={day.date}
                      className={`flex items-center gap-3 rounded px-3 py-1.5 text-sm ${isWeekend ? 'opacity-40' : ''}`}
                    >
                      <span className="w-8 font-mono text-xs text-muted-foreground capitalize">{weekday}</span>
                      <span className="w-20 font-mono text-xs">
                        {new Date(day.date + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                      </span>
                      <div className="flex-1 h-5 bg-secondary rounded-sm overflow-hidden">
                        {day.hours > 0 && (
                          <div
                            className="h-full bg-accent/70 rounded-sm transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        )}
                      </div>
                      <span className="w-16 text-right font-mono text-xs">
                        {day.hours > 0 ? formatHours(day.hours) : '—'}
                      </span>
                      {day.leaveType && (
                        <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded capitalize">
                          {day.leaveType}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
