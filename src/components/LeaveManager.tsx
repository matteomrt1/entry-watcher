import { useState, useMemo } from 'react';
import { addLeave, loadData, removeLeave, getEmployees, type LeaveEntry } from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, CalendarPlus, Palmtree, Clock, Stethoscope, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

interface LeaveManagerProps {
  refreshKey?: number;
  onUpdate?: () => void;
}

const leaveTypes = [
  { value: 'ferie', label: 'Ferie', icon: Palmtree },
  { value: 'permesso', label: 'Permesso', icon: Clock },
  { value: 'malattia', label: 'Malattia', icon: Stethoscope },
  { value: 'altro', label: 'Altro', icon: MoreHorizontal },
] as const;

export default function LeaveManager({ refreshKey, onUpdate }: LeaveManagerProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<LeaveEntry['type']>('ferie');
  const [hours, setHours] = useState('8');
  const [note, setNote] = useState('');

  const employees = useMemo(() => getEmployees(), [refreshKey]);
  const leaves = useMemo(() => {
    return loadData().leaves.sort((a, b) => b.date.localeCompare(a.date));
  }, [refreshKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Inserisci il nome della risorsa');
      return;
    }

    addLeave({
      employeeName: name.trim(),
      date,
      type,
      hours: type === 'permesso' ? parseFloat(hours) : undefined,
      note: note.trim() || undefined,
    });

    toast.success(`${leaveTypes.find(t => t.value === type)?.label} registrato per ${name}`);
    setName('');
    setNote('');
    onUpdate?.();
  };

  const handleDelete = (id: string) => {
    removeLeave(id);
    toast.success('Voce rimossa');
    onUpdate?.();
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <form onSubmit={handleSubmit} className="stat-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-accent" />
          Registra Assenza
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Risorsa</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome risorsa"
              list="employees-list"
            />
            <datalist id="employees-list">
              {employees.map(e => <option key={e} value={e} />)}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as LeaveEntry['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === 'permesso' && (
            <div className="space-y-2">
              <Label>Ore</Label>
              <Input type="number" min="0.5" max="8" step="0.5" value={hours} onChange={e => setHours(e.target.value)} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Note (opzionale)</Label>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note aggiuntive..." />
        </div>

        <Button type="submit" className="bg-accent hover:bg-accent/90">
          Registra
        </Button>
      </form>

      {/* List */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Storico Assenze</h3>
        {leaves.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nessuna assenza registrata</p>
        ) : (
          leaves.map(leave => {
            const lt = leaveTypes.find(t => t.value === leave.type);
            const Icon = lt?.icon || MoreHorizontal;
            return (
              <div key={leave.id} className="fade-in flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="rounded-full p-2 bg-secondary">
                  <Icon className="h-4 w-4 text-secondary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{leave.employeeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {lt?.label}{leave.hours ? ` - ${leave.hours}h` : ''}{leave.note ? ` · ${leave.note}` : ''}
                  </p>
                </div>
                <p className="font-mono text-sm text-muted-foreground">
                  {new Date(leave.date + 'T00:00:00').toLocaleDateString('it-IT')}
                </p>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(leave.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
