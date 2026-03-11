import { useMemo, useState } from 'react';
import {
  loadData,
  getEmployeesProfiles,
  getReviewEntries,
  type AttendanceEntry,
  type EmployeeProfile,
} from '@/lib/attendance';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  UserCheck,
  UserX,
  AlertTriangle,
  Clock,
  LogOut,
  ShieldAlert,
  Timer,
  Activity,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface LiveBoardProps {
  refreshKey?: number;
}

interface AnomalyItem {
  type: 'ritardo' | 'mancante' | 'straordinario';
  employeeName: string;
  detail: string;
  entry?: AttendanceEntry;
}

export default function LiveBoard({ refreshKey }: LiveBoardProps) {
  const [resolveTarget, setResolveTarget] = useState<AnomalyItem | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const now = useMemo(() => new Date(), [refreshKey]);

  const profiles = useMemo(() => getEmployeesProfiles(), [refreshKey]);
  const data = useMemo(() => loadData(), [refreshKey]);
  const reviewEntries = useMemo(() => getReviewEntries(), [refreshKey]);

  // ── Roster: stato per ogni dipendente ──
  const roster = useMemo(() => {
    const allNames = new Set<string>();
    profiles.forEach(p => allNames.add(p.name));
    data.entries.forEach(e => allNames.add(e.employeeName));

    return Array.from(allNames).map(name => {
      const todayEntries = data.entries
        .filter(e => e.employeeName === name && e.timestamp.startsWith(today))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const last = todayEntries[todayEntries.length - 1] ?? null;
      const isIn = last?.type === 'check-in';

      return {
        name,
        isIn,
        lastTimestamp: last ? new Date(last.timestamp) : null,
        profile: profiles.find(p => p.name === name) ?? null,
        todayCount: todayEntries.length,
      };
    });
  }, [profiles, data, today, refreshKey]);

  const inCount = roster.filter(r => r.isIn).length;
  const outCount = roster.length - inCount;

  // ── Anomalie ──
  const anomalies = useMemo<AnomalyItem[]>(() => {
    const items: AnomalyItem[] = [];

    // Ritardo Critico
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const r of roster) {
      if (!r.profile?.expectedIn1) continue;
      const [h, m] = r.profile.expectedIn1.split(':').map(Number);
      const expectedMinutes = h * 60 + m;

      // Oltre 15 min di ritardo e nessuna timbratura oggi
      if (nowMinutes > expectedMinutes + 15 && r.todayCount === 0) {
        // Controlla se ha un congedo oggi
        const hasLeave = data.leaves.some(
          l => l.employeeName === r.name && l.date === today
        );
        if (!hasLeave) {
          items.push({
            type: 'ritardo',
            employeeName: r.name,
            detail: `Atteso alle ${r.profile.expectedIn1}, nessuna timbratura alle ${format(now, 'HH:mm')}`,
          });
        }
      }
    }

    // Timbrature mancanti (dal motore di riconciliazione)
    for (const entry of reviewEntries) {
      items.push({
        type: 'mancante',
        employeeName: entry.employeeName,
        detail: `Timbratura auto-generata il ${format(parseISO(entry.timestamp), 'dd/MM/yyyy')} alle ${format(parseISO(entry.timestamp), 'HH:mm')}`,
        entry,
      });
    }

    // Straordinario sospetto
    for (const r of roster) {
      if (!r.isIn || !r.profile?.expectedOut2) continue;
      const [h, m] = r.profile.expectedOut2.split(':').map(Number);
      const expectedOutMinutes = h * 60 + m;

      if (nowMinutes > expectedOutMinutes + 45) {
        items.push({
          type: 'straordinario',
          employeeName: r.name,
          detail: `In sede oltre le ${r.profile.expectedOut2} (+${nowMinutes - expectedOutMinutes} min)`,
        });
      }
    }

    return items;
  }, [roster, reviewEntries, data.leaves, now, today, refreshKey]);

  const todayAnomalies = anomalies.filter(a => a.type !== 'mancante');
  const totalAnomalyCount = todayAnomalies.length + reviewEntries.length;

  const initials = (name: string) =>
    name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const anomalyConfig = {
    ritardo: {
      icon: AlertTriangle,
      label: 'Ritardo Critico',
      badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
      iconClass: 'text-destructive',
    },
    mancante: {
      icon: Clock,
      label: 'Timbratura Mancante',
      badgeClass: 'bg-warning/15 text-warning border-warning/30',
      iconClass: 'text-warning',
    },
    straordinario: {
      icon: Timer,
      label: 'Straordinario Sospetto',
      badgeClass: 'bg-primary/15 text-primary border-primary/30',
      iconClass: 'text-primary',
    },
  } as const;

  return (
    <div className="space-y-5">
      {/* ── KPI Header ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-accent/15 p-2.5">
              <UserCheck className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono leading-none">{inCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                In Sede / {roster.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2.5">
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono leading-none">{outCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Assenti / Fuori</p>
            </div>
          </CardContent>
        </Card>

        <Card className={totalAnomalyCount > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-muted'}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`rounded-lg p-2.5 ${totalAnomalyCount > 0 ? 'bg-destructive/15' : 'bg-muted'}`}>
              <ShieldAlert className={`h-5 w-5 ${totalAnomalyCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono leading-none">{totalAnomalyCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Anomalie</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Chi è in sede ── */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Chi è in sede
            </h3>
            <ScrollArea className="h-[360px] pr-2">
              <div className="grid grid-cols-2 gap-2">
                {roster
                  .sort((a, b) => (a.isIn === b.isIn ? a.name.localeCompare(b.name) : a.isIn ? -1 : 1))
                  .map(r => (
                    <div
                      key={r.name}
                      className={`flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors ${
                        r.isIn
                          ? 'border-accent/40 bg-accent/5'
                          : 'border-border bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-[10px] font-semibold bg-secondary text-secondary-foreground">
                            {initials(r.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                            r.isIn ? 'bg-accent animate-pulse' : 'bg-muted-foreground/40'
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {r.lastTimestamp
                            ? format(r.lastTimestamp, 'HH:mm', { locale: it })
                            : '—'}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${
                          r.isIn
                            ? 'border-accent/40 text-accent'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {r.isIn ? 'IN' : 'OUT'}
                      </Badge>
                    </div>
                  ))}
                {roster.length === 0 && (
                  <p className="col-span-2 text-sm text-muted-foreground text-center py-8">
                    Nessuna risorsa registrata
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ── Cruscotto Anomalie ── */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Cruscotto Anomalie
            </h3>
            <ScrollArea className="h-[360px] pr-2">
              <div className="space-y-2">
                {anomalies.length === 0 ? (
                  <div className="text-center py-12">
                    <UserCheck className="h-8 w-8 text-accent mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nessuna anomalia rilevata</p>
                  </div>
                ) : (
                  anomalies.map((a, i) => {
                    const cfg = anomalyConfig[a.type];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={`${a.type}-${a.employeeName}-${i}`}
                        className="flex items-start gap-3 rounded-lg border p-3"
                      >
                        <div className={`rounded-md p-1.5 mt-0.5 ${cfg.badgeClass}`}>
                          <Icon className={`h-4 w-4 ${cfg.iconClass}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold truncate">{a.employeeName}</span>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${cfg.badgeClass}`}>
                              {cfg.label}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {a.detail}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 shrink-0"
                          onClick={() => setResolveTarget(a)}
                        >
                          Risolvi
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog Risolvi ── */}
      <Dialog open={!!resolveTarget} onOpenChange={open => !open && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Risolvi Anomalia</DialogTitle>
            <DialogDescription>
              {resolveTarget && (
                <>
                  <span className="font-medium text-foreground">{resolveTarget.employeeName}</span>
                  {' — '}
                  {anomalyConfig[resolveTarget.type].label}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            {resolveTarget?.detail}
          </div>
          <p className="text-xs text-muted-foreground italic">
            Questa funzionalità verrà completata con azioni HR specifiche (modifica orario, giustificazione, ecc.).
          </p>
          <div className="flex justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setResolveTarget(null)}>
              Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
