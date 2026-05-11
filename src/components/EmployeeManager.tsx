import { useState, useMemo } from 'react';
import { getEmployeesProfiles, getEmployees, addEmployee, updateEmployee, deleteEmployee, SHIFT_PRESETS, type EmployeeProfile, type ShiftType, type TrackingMode } from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const allKnownNames = useMemo(() => getEmployees(), [refreshKey]);
  
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
    if (!form.name.trim()) { toast.error('Seleziona una risorsa dal menu'); return; }
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
  const isAuto = form.trackingMode === 'auto';

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
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifica Risorsa' : 'Nuova Risorsa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              
              {/* Selezione Nome - Menu a tendina dal Database */}
              <div>
                <Label>Nome Risorsa</Label>
                <Select 
                  value={form.name || undefined} 
                  onValueChange={v => setForm(f => ({ ...f, name: v }))}
                  disabled={!!editingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona dal database..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allKnownNames.length === 0 ? (
                      <SelectItem value="nessuno" disabled>Nessuna timbratura nel DB</SelectItem>
                    ) : (
                      allKnownNames.map(n => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {!editingId && allKnownNames.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Per aggiungere una risorsa, fai prima una scansione QR.</p>
                )}
              </div>

              {/* Tracking mode toggle */}
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
                        <ScanLine className="h-4 w-4" /> Tracciamento Manuale (QR)
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Dipendente standard: timbra con QR Code. Appare la configurazione della pausa pranzo.
                      </p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${form.trackingMode === 'auto' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <RadioGroupItem value="auto" id="tm-auto" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Truck className="h-4 w-4" /> Tracciamento Automatico
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Camionisti / smart working. Appare la configurazione dei turni per l'autocompilazione.
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* AUTOMATICO: Mostra solo i Turni */}
              {isAuto && (
                <>
                  <div>
                    <Label>Turno per autocompilazione</Label>
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
                  
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                    <strong className="text-foreground">Nota:</strong> per le risorse in modalità automatica le ore lavorate sono già coerenti con il turno; nessuna pausa pranzo viene detratta.
                  </div>
                </>
              )}

              {/* MANUALE: Mostra solo la Pausa Pranzo */}
              {!isAuto && (
                <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
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
                  <p className="text-xs text-muted-foreground">
                    Detratta nei giorni con sole 2 timbrature, solo per la porzione che cade nell'orario lavorato.
                  </p>
                  <div>
                    <Label className="text-xs">Minuti fissi (fallback)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      value={form.defaultBreakMinutes}
                      onChange={e => setForm(f => ({ ...f, defaultBreakMinutes: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Usato se la finestra pausa non è impostata.</p>
                  </div>
                </div>
              )}

              <Button onClick={handleSave} className="w-full">{editingId ? 'Salva Modifiche' : 'Aggiungi'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {profiles.length === 0 ? (
        <div className="stat-card text-center py-10 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nessuna risorsa configurata</p>
          <p className="text-xs mt-1">Esegui una scansione QR per popolare il database, poi configura qui la risorsa.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {profiles.map(p => {
            const mode = p.trackingMode ?? 'manual';
            return (
              <div key={p.id} className="stat-card flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{p.name}</p>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${mode === 'auto' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-primary/15 text-primary'}`}>
                      {mode === 'auto' ? '⚡ Auto' : '📷 QR'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {mode === 'auto' && (
                      <>
                        <span className="text-xs font-medium text-primary">{shiftLabels[p.shift || 'personalizzato']}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {p.expectedIn1}–{p.expectedOut1}
                          {p.expectedIn2 && ` | ${p.expectedIn2}–${p.expectedOut2}`}
                        </span>
                      </>
                    )}
                    {mode === 'manual' && p.lunchBreakStart && p.lunchBreakEnd && (
                      <span className="text-xs text-muted-foreground">· Pausa {p.lunchBreakStart}–{p.lunchBreakEnd}</span>
                    )}
                    {mode === 'manual' && (!p.lunchBreakStart || !p.lunchBreakEnd) && (p.defaultBreakMinutes ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground">· Pausa {p.defaultBreakMinutes}min</span>
                    )}
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
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare la configurazione di <strong>{deleteTarget?.name}</strong>? Questa azione non elimina lo storico timbrature, solo le regole assegnate.
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
