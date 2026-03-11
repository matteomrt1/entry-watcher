import { useMemo, useState } from 'react';
import {
  getEmployeesProfiles,
  calculateTimeBank,
  formatHours,
  loadSettings,
  saveSettings,
  type SystemSettings,
} from '@/lib/attendance';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Settings,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';

interface TimeBankPanelProps {
  refreshKey?: number;
}

export default function TimeBankPanel({ refreshKey }: TimeBankPanelProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [settings, setSettings] = useState<SystemSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editRounding, setEditRounding] = useState(String(settings.roundingMinutes));
  const [editGrace, setEditGrace] = useState(String(settings.gracePeriodMinutes));

  const profiles = useMemo(() => getEmployeesProfiles(), [refreshKey]);

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  const tableData = useMemo(() => {
    return profiles.map(p => {
      const result = calculateTimeBank(p.name, monthStart, monthEnd);
      return { ...p, ...result };
    });
  }, [profiles, monthStart, monthEnd, refreshKey, settings]);

  const handleSaveSettings = () => {
    const newSettings: SystemSettings = {
      roundingMinutes: Number(editRounding) || 0,
      gracePeriodMinutes: Number(editGrace) || 0,
    };
    saveSettings(newSettings);
    setSettings(newSettings);
    setSettingsOpen(false);
  };

  const openSettingsDialog = () => {
    setEditRounding(String(settings.roundingMinutes));
    setEditGrace(String(settings.gracePeriodMinutes));
    setSettingsOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold capitalize min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </h2>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={openSettingsDialog}>
              <Settings className="h-4 w-4 mr-1.5" />
              Impostazioni Tolleranza
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Impostazioni Tolleranza</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Arrotondamento (minuti)</Label>
                <Select value={editRounding} onValueChange={setEditRounding}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Nessuno</SelectItem>
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Grace Period (minuti)</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={editGrace}
                  onChange={e => setEditGrace(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Ritardi/anticipi sotto questa soglia vengono abbuonati.
                </p>
              </div>
              <Button className="w-full" onClick={handleSaveSettings}>
                Salva Impostazioni
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-accent/15 p-2.5">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono leading-none">
                {tableData.filter(d => d.balanceHours > 0).length}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">A credito</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-destructive/15 p-2.5">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono leading-none">
                {tableData.filter(d => d.balanceHours < 0).length}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">A debito</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2.5">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono leading-none">
                {tableData.filter(d => d.balanceHours === 0).length}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">In pari</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nessuna risorsa registrata. Aggiungi dipendenti nella tab "Risorse".
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risorsa</TableHead>
                  <TableHead className="text-right">Ore Attese</TableHead>
                  <TableHead className="text-right">Ore Lavorate (Nette)</TableHead>
                  <TableHead className="text-right">Saldo Banca Ore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <div>
                        <span>{row.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          {row.weeklyHours ?? 40}h/sett
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatHours(row.expectedHours)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatHours(row.workedHours)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.balanceHours > 0 ? (
                        <Badge className="bg-accent/15 text-accent border-accent/30 font-mono gap-1">
                          <TrendingUp className="h-3 w-3" />
                          + {formatHours(row.balanceHours)}
                        </Badge>
                      ) : row.balanceHours < 0 ? (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30 font-mono gap-1">
                          <TrendingDown className="h-3 w-3" />
                          {formatHours(row.balanceHours)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-mono text-muted-foreground gap-1">
                          <Clock className="h-3 w-3" />
                          0h 00m
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Footer info */}
      <p className="text-[11px] text-muted-foreground text-center">
        Arrotondamento: {settings.roundingMinutes === 0 ? 'Nessuno' : `${settings.roundingMinutes} min`}
        {' · '}Grace Period: {settings.gracePeriodMinutes} min
      </p>
    </div>
  );
}
