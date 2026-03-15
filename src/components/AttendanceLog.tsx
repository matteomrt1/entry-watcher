import { loadData, getEmployees, type AttendanceEntry } from '@/lib/attendance';
import { LogIn, LogOut, Filter, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface AttendanceLogProps {
  refreshKey?: number;
  limit?: number;
  showFilters?: boolean;
}

export default function AttendanceLog({ refreshKey, limit = 20, showFilters = false }: AttendanceLogProps) {
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'check-in' | 'check-out'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilterBar, setShowFilterBar] = useState(showFilters);

  const employees = useMemo(() => getEmployees(), [refreshKey]);

  const entries = useMemo(() => {
    const data = loadData();
    let filtered = data.entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filterEmployee !== 'all') {
      filtered = filtered.filter(e => e.employeeName === filterEmployee);
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.type === filterType);
    }
    if (filterDateFrom) {
      filtered = filtered.filter(e => e.timestamp.split('T')[0] >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter(e => e.timestamp.split('T')[0] <= filterDateTo);
    }

    return filtered.slice(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, limit, filterEmployee, filterType, filterDateFrom, filterDateTo]);

  const hasActiveFilters = filterEmployee !== 'all' || filterType !== 'all' || filterDateFrom || filterDateTo;

  const clearFilters = () => {
    setFilterEmployee('all');
    setFilterType('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  if (entries.length === 0 && !hasActiveFilters) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nessun ingresso registrato</p>
        <p className="text-sm mt-1">Scansiona un QR code per iniziare</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter toggle + bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilterBar(v => !v)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtri
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-accent text-accent-foreground px-1.5 py-0.5 text-xs font-bold">!</span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-3 w-3" /> Resetta
          </Button>
        )}
      </div>

      {showFilterBar && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border bg-card">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Risorsa</label>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as 'all' | 'check-in' | 'check-out')}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="check-in">Ingresso</SelectItem>
                <SelectItem value="check-out">Uscita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Da</label>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">A</label>
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-9" />
          </div>
        </div>
      )}

      {/* Results */}
      {entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nessun risultato con i filtri selezionati</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry }: { entry: AttendanceEntry }) {
  const date = new Date(entry.timestamp);
  const isIn = entry.type === 'check-in';

  return (
    <div className="fade-in flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-secondary/50">
      <div className={`rounded-full p-2 ${isIn ? 'bg-accent/10 text-accent' : 'bg-warning/10 text-warning'}`}>
        {isIn ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{entry.employeeName}</p>
        <p className="text-xs text-muted-foreground">
          {isIn ? 'Ingresso' : 'Uscita'}
          {entry.isAutoFilled && ' · Auto'}
          {entry.requiresReview && ' · ⚠️ Da revisionare'}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm">{date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
        <p className="text-xs text-muted-foreground">{date.toLocaleDateString('it-IT')}</p>
      </div>
    </div>
  );
}
