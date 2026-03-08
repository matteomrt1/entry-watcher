import { useState, useMemo } from 'react';
import { getReviewEntries, updateEntry, type AttendanceEntry } from '@/lib/attendance';
import { AlertTriangle, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ReviewPanelProps {
  refreshKey?: number;
  onUpdate?: () => void;
}

export default function ReviewPanel({ refreshKey, onUpdate }: ReviewPanelProps) {
  const entries = useMemo(() => getReviewEntries(), [refreshKey]);
  const [editing, setEditing] = useState<AttendanceEntry | null>(null);
  const [newTime, setNewTime] = useState('');

  if (entries.length === 0) return null;

  const openCorrect = (entry: AttendanceEntry) => {
    const d = new Date(entry.timestamp);
    setNewTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setEditing(entry);
  };

  const handleConfirm = () => {
    if (!editing) return;
    const date = editing.timestamp.split('T')[0];
    const newTimestamp = `${date}T${newTime}:00`;
    updateEntry(editing.id, { timestamp: newTimestamp, requiresReview: false });
    toast.success('Timbratura confermata');
    setEditing(null);
    onUpdate?.();
  };

  return (
    <div className="stat-card border-warning/30 bg-warning/5 space-y-3">
      <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2 text-warning">
        <AlertTriangle className="h-4 w-4" /> Timbrature da Verificare ({entries.length})
      </h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {entries.map(e => {
          const d = new Date(e.timestamp);
          return (
            <div key={e.id} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{e.employeeName}</span>
                <span className="text-muted-foreground ml-2">
                  {d.toLocaleDateString('it-IT')} — {e.type === 'check-in' ? 'Ingresso' : 'Uscita'} auto: {d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => openCorrect(e)} className="gap-1">
                <Check className="h-3 w-3" /> Correggi
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correggi Timbratura</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 pt-2">
              <p className="text-sm">
                <strong>{editing.employeeName}</strong> — {new Date(editing.timestamp).toLocaleDateString('it-IT')} — {editing.type === 'check-in' ? 'Ingresso' : 'Uscita'}
              </p>
              <div>
                <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Orario corretto</Label>
                <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
              </div>
              <Button onClick={handleConfirm} className="w-full">Conferma e Salva</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
