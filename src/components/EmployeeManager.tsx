import { useState, useMemo } from 'react';
import { getEmployeesProfiles, addEmployee, updateEmployee, deleteEmployee, SHIFT_PRESETS, type EmployeeProfile, type ShiftType } from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Pencil, Trash2, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeManagerProps {
  refreshKey?: number;
  onUpdate?: () => void;
}

interface EmployeeFormData {
  name: string;
  shift: ShiftType;
  expectedIn1: string;
  expectedOut1: string;
  expectedIn2: string;
  expectedOut2: string;
  defaultBreakMinutes: number;
}

const emptyForm: EmployeeFormData = {
  name: '',
  shift: 'spezzato',
  expectedIn1: '08:00',
  expectedOut1: '12:00',
  expectedIn2: '13:00',
  expectedOut2: '17:00',
  defaultBreakMinutes: 0,
};

const shiftLabels: Record<ShiftType, string> = {
  mattina: '☀️ Mattina',
  pomeriggio: '🌤️ Pomeriggio',
  notte: '🌙 Notte',
  spezzato: '📋 Spezzato',
  personalizzato: '⚙️ Personalizzato',
};

export default function EmployeeManager({ refreshKey, onUpdate }: EmployeeManagerProps) {
  const profiles = useMemo(() => getEmployeesProfiles(), [refreshKey]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: EmployeeProfile) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      shift: p.shift || 'personalizzato',
      expectedIn1: p.expectedIn1,
      expectedOut1: p.expectedOut1,
      expectedIn2: p.expectedIn2,
      expectedOut2: p.expectedOut2,
      defaultBreakMinutes: p.defaultBreakMinutes ?? 0,
    });
    setOpen(true);
  };

  const handleShiftChange = (shift: ShiftType) => {
    if (shift === 'personalizzato') {
      setForm(f => ({ ...f, shift }));
    } else {
      const preset = SHIFT_PRESETS[shift];
      setForm(f => ({
        ...f,
        shift,
        expectedIn1: preset.expectedIn1,
        expectedOut1: preset.expectedOut1,
        expectedIn2: preset.expectedIn2,
        expectedOut2: preset.expectedOut2,
      }));
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Inserisci il nome'); return; }
    if (editingId) {
      updateEmployee(editingId, form);
      toast.success('Risorsa aggiornata');
    } else {
      addEmployee(form);
      toast.success('Risorsa aggiunta');
    }
    setOpen(false);
    onUpdate?.();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteEmployee(deleteTarget.id);
    toast.success('Profilo eliminato');
    setDeleteTarget(null);
    onUpdate?.();
  };

  const setField = (key: keyof EmployeeFormData, value: string) => {
    setForm(f => ({ ...f, [key]: value, shift: 'personalizzato' as ShiftType }));
  };

  const isDoubleShift = form.shift === 'spezzato' || form.shift === 'personalizzato';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Anagrafica Risorse
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2"><UserPlus className="h-4 w-4" /> Aggiungi Risorsa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifica Risorsa' : 'Nuova Risorsa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mario Rossi" />
              </div>

              <div>
                <Label>Turno</Label>
                <Select value={form.shift} onValueChange={(v) => handleShiftChange(v as ShiftType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(shiftLabels) as ShiftType[]).map(s => (
                      <SelectItem key={s} value={s}>{shiftLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Ingresso 1</Label>
                  <Input type="time" value={form.expectedIn1} onChange={e => setField('expectedIn1', e.target.value)} />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Uscita 1</Label>
                  <Input type="time" value={form.expectedOut1} onChange={e => setField('expectedOut1', e.target.value)} />
                </div>
                {isDoubleShift && (
                  <>
                    <div>
                      <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Ingresso 2</Label>
                      <Input type="time" value={form.expectedIn2} onChange={e => setField('expectedIn2', e.target.value)} />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Uscita 2</Label>
                      <Input type="time" value={form.expectedOut2} onChange={e => setField('expectedOut2', e.target.value)} />
                    </div>
                  </>
                )}
              </div>

              <Button onClick={handleSave} className="w-full">{editingId ? 'Salva Modifiche' : 'Aggiungi'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {profiles.length === 0 ? (
        <div className="stat-card text-center py-10 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nessuna risorsa configurata</p>
          <p className="text-xs mt-1">Aggiungi le risorse per abilitare la riconciliazione automatica</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {profiles.map(p => (
            <div key={p.id} className="stat-card flex items-center justify-between">
              <div>
                <p className="font-semibold">{p.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-primary">{shiftLabels[p.shift || 'personalizzato']}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {p.expectedIn1}–{p.expectedOut1}
                    {p.expectedIn2 && ` | ${p.expectedIn2}–${p.expectedOut2}`}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: p.id, name: p.name })} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare il profilo di <strong>{deleteTarget?.name}</strong>? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}