import { loadData, type AttendanceEntry } from '@/lib/attendance';
import { LogIn, LogOut } from 'lucide-react';
import { useMemo } from 'react';

interface AttendanceLogProps {
  refreshKey?: number;
  limit?: number;
}

export default function AttendanceLog({ refreshKey, limit = 20 }: AttendanceLogProps) {
  const entries = useMemo(() => {
    const data = loadData();
    return data.entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, limit]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nessun ingresso registrato</p>
        <p className="text-sm mt-1">Scansiona un QR code per iniziare</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} />
      ))}
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
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm">{date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
        <p className="text-xs text-muted-foreground">{date.toLocaleDateString('it-IT')}</p>
      </div>
    </div>
  );
}
