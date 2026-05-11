import { useState, useMemo } from 'react';
import { getEmployeesProfiles, getEmployees, addEmployee, updateEmployee, deleteEmployee, SHIFT_PRESETS, type EmployeeProfile, type ShiftType, type TrackingMode } from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserPlus, Pencil, Trash2, Clock, Users, Truck, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeManagerProps {
  refreshKey?: number;
  onUpdate?: () => void;
}

interface EmployeeFormData {
  name: string;
  trackingMode: TrackingMode;
  shift: ShiftType;
  expectedIn1: string;
  expectedOut1: string;
  expectedIn2: string;
  expectedOut2: string;
  defaultBreakMinutes: number;
  lunchBreakStart: string;
  lunchBreakEnd: string;
}

const emptyForm: EmployeeFormData = {
  name: '',
  trackingMode: 'manual',
  shift: 'spezzato',
  expectedIn1: '08:00',
  expectedOut1: '12:00',
  expectedIn2: '13:00',
  expectedOut2: '17:00',
  defaultBreakMinutes: 0,
  lunchBreakStart: '',
  lunchBreakEnd: '',
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
  const allKnownNames = useMemo(() => getEmployees(), [refreshKey]); // Recupera nomi da tutto il DB
  
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
      trackingMode: p.trackingMode ?? 'manual',
      shift: p.shift || 'personalizzato',
      expectedIn1: p.expectedIn1,
      expectedOut1: p.expectedOut1,
      expectedIn2: p.expectedIn2,
      expectedOut2: p.expectedOut2,
      defaultBreakMinutes: p.defaultBreakMinutes ?? 0,
      lunchBreakStart: p.lunchBreakStart ?? '',
      lunchBreakEnd: p.lunchBreakEnd ?? '',
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
    if (!form.name) { toast.error('Seleziona una risorsa'); return; }
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

  const setField = (key: keyof EmployeeFormData, value: string) => {
    setForm(f => ({ ...f, [key]: value, shift: 'personalizzato' as ShiftType }));
  };

  const isDoubleShift = form.shift === 'spezzato' || form.shift === 'personalizzato';
  const isAuto = form.trackingMode === 'auto';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Anagrafica Risorse
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2"><UserPlus className="h-4 w-4" /> Configura Risorsa</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifica Configurazione' : 'Nuova Configurazione'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              
              {/* Selezione Nome da Dropdown */}
              <div>
                <Label>Seleziona Risorsa</Label>
                <Select 
                  value={form.name} 
                  onValueChange={(v) => setForm(f => ({ ...f, name: v }))}
                  disabled={!!editingId} // Impedisce di cambiare nome in fase di modifica
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Scegli un nome registrato..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allKnownNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Modalità di tracciamento */}
              <div className="rounded-lg border border-border p-3 bg-muted/30">
                <Label className="text-sm font-semibold mb-2 block">Modalità di tracciamento</Label>
                <RadioGroup
                  value={form.trackingMode}
                  onValueChange={(v) => setForm(f => ({ ...f, trackingMode: v as TrackingMode }))}
                  className="grid gap-2"
                >
                  <label className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${form.trackingMode === 'manual' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <RadioGroupItem value="manual" id="tm-manual" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <ScanLine className="h-4 w-4" /> Manuale (QR)
                      </div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${form.trackingMode === 'auto' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <RadioGroupItem value="auto" id="tm-auto" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Truck className="h-4 w-4" /> Automatico
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Sezione AUTOMATICO: Mostra solo i Turni */}
              {isAuto && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                  <div>
                    <Label>Turno per autocompilazione</Label>
                    <Select value={form.shift} onValueChange={(v) => handleShiftChange(v as ShiftType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(shiftLabels) as ShiftType[]).map(s => (
                          <SelectItem key={s} value={s}>{shiftLabels[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Ingresso 1</Label>
                      <Input type="time" value={form.expectedIn1} onChange={e => setField('expectedIn1', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Uscita 1</Label>
                      <Input type="time" value={form.expectedOut1} onChange={e => setField('expectedOut1', e.target.value)} />
                    </div>
                    {isDoubleShift && (
                      <>
                        <div>
                          <Label className="text-xs">Ingresso 2</Label>
                          <Input type="time" value={form.expectedIn2} onChange={e => setField('expectedIn2', e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Uscita 2</Label>
                          <Input type="time" value={form.expectedOut2} onChange={e => setField('expectedOut2', e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Sezione MANUALE: Mostra solo la Pausa Pranzo */}
              {!isAuto && (
                <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30 animate-in fade-in slide-in-from-top-1">
                  <p className="text-sm font-semibold flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Pausa pranzo automatica</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Inizio pausa</Label>
                      <Input type="time" value={form.lunchBreakStart} onChange={e => setForm(f => ({ ...f, lunchBreakStart: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Fine pausa</Label>
                      <Input type="time" value={form.lunchBreakEnd} onChange={e => setForm(f => ({ ...f, lunchBreakEnd: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Minuti fissi (fallback)</Label>
                    <Input
                      type="number"
                      value={form.defaultBreakMinutes}
                      onChange={e => setForm(f => ({ ...f, defaultBreakMinutes: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              )}

              <Button onClick={handleSave} className="w-full">{editingId ? 'Salva Modifiche' : 'Salva'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Elenco Risorse esistenti (Resta invariato nel rendering dei card) */}
      <div className="grid gap-3">
        {profiles.map(p => (
          <div key={p.id} className="stat-card flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{p.name}</p>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${p.trackingMode === 'auto' ? 'bg-amber-500/20 text-amber-600' : 'bg-primary/15 text-primary'}`}>
                  {p.trackingMode === 'auto' ? '⚡ Auto' : '📷 QR'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: p.id, name: p.name })} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      {/* ... AlertDialog di eliminazione omesso per brevità, resta lo stesso ... */}
    </div>
  );
}
