import { useState, useEffect, useRef } from 'react';
import { ScanLine, ClipboardList, CalendarOff, BarChart3, Database, LayoutDashboard, CalendarDays, Users, Monitor, Wallet, Briefcase, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { runReconciliation, runAutoFill, initData, isServerAvailable, setSaveErrorHandler } from '@/lib/attendance';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import QRScanner from '@/components/QRScanner';
import AttendanceLog from '@/components/AttendanceLog';
import LeaveManager from '@/components/LeaveManager';
import ReportView from '@/components/ReportView';
import Dashboard from '@/components/Dashboard';
import DataManager from '@/components/DataManager';
import CalendarView from '@/components/CalendarView';
import EmployeeManager from '@/components/EmployeeManager';
import LiveBoard from '@/components/LiveBoard';
import TimeBankPanel from '@/components/TimeBankPanel';
import ProjectManager from '@/components/ProjectManager';

type Tab = 'dashboard' | 'liveboard' | 'scan' | 'log' | 'calendar' | 'leave' | 'report' | 'timebank' | 'employees' | 'projects';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'liveboard', label: 'Live Board', icon: Monitor },
  { id: 'scan', label: 'Scanner', icon: ScanLine },
  { id: 'log', label: 'Registro', icon: ClipboardList },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'leave', label: 'Assenze', icon: CalendarOff },
  { id: 'report', label: 'Report', icon: BarChart3 },
  { id: 'timebank', label: 'Banca Ore', icon: Wallet },
  { id: 'projects', label: 'Progetti', icon: Briefcase },
  { id: 'employees', label: 'Risorse', icon: Users },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState(false);
  const bootDone = useRef(false);

  const refresh = () => setRefreshKey(k => k + 1);

  const boot = async () => {
    setLoading(true);
    setBootError(null);
    try {
      await initData();
      setServerOk(isServerAvailable());
      const filled = runAutoFill();
      if (filled > 0) toast.info(`Autocompilazione: generate ${filled} timbrature per risorse automatiche`);
      const recon = runReconciliation();
      if (recon > 0) toast.info(`Riconciliazione: ${recon} uscita/e mancante/i generate`);
      refresh();
    } catch (err) {
      setServerOk(false);
      setBootError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bootDone.current) return;
    bootDone.current = true;
    setSaveErrorHandler((err) => {
      setServerOk(false);
      toast.error(`Salvataggio su database.json fallito: ${err.message}`, {
        description: 'Riavvia il server: node server.js',
        duration: 8000,
      });
    });
    boot();
    return () => setSaveErrorHandler(null);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Lettura di database.json dal server locale…</p>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h1 className="text-lg font-bold">Server locale non in esecuzione</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            L'applicazione non riesce a leggere <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">database.json</code> perché il server di persistenza non risponde su <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">http://localhost:3001</code>.
          </p>
          <div className="rounded-md bg-card border p-3 text-xs font-mono space-y-1">
            <p className="text-muted-foreground"># Apri un terminale nella cartella del progetto:</p>
            <p>node server.js</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Dettaglio errore: <span className="font-mono">{bootError}</span>
          </p>
          <Button onClick={boot} className="w-full gap-2">
            <RefreshCw className="h-4 w-4" /> Riprova
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2">
              <ScanLine className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Presenze</h1>
              <p className="text-xs text-muted-foreground">Monitoraggio Ingressi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DataManager onImport={refresh} />
            <div
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${serverOk ? 'bg-accent/15 text-accent' : 'bg-destructive/15 text-destructive'}`}
              title={serverOk ? 'Connesso a database.json (porta 3001)' : 'Server NON raggiungibile — le modifiche non vengono salvate'}
            >
              {serverOk ? <Database className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              <span>{serverOk ? 'database.json OK' : 'Server OFFLINE'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-[73px] z-40">
        <div className="container mx-auto px-4 flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {activeTab === 'dashboard' && (
          <Dashboard refreshKey={refreshKey} onUpdate={refresh} />
        )}

        {activeTab === 'liveboard' && (
          <LiveBoard refreshKey={refreshKey} />
        )}

        {activeTab === 'scan' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Scansiona QR Code</h2>
              <QRScanner onScan={refresh} />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-4">Ultimi Ingressi</h2>
              <AttendanceLog refreshKey={refreshKey} limit={10} onUpdate={refresh} />
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Registro Completo</h2>
            <AttendanceLog refreshKey={refreshKey} limit={500} showFilters onUpdate={refresh} />
          </div>
        )}

        {activeTab === 'calendar' && (
          <CalendarView refreshKey={refreshKey} onUpdate={refresh} />
        )}

        {activeTab === 'leave' && (
          <LeaveManager refreshKey={refreshKey} onUpdate={refresh} />
        )}

        {activeTab === 'report' && (
          <ReportView refreshKey={refreshKey} />
        )}

        {activeTab === 'timebank' && (
          <TimeBankPanel refreshKey={refreshKey} />
        )}

        {activeTab === 'projects' && (
          <ProjectManager refreshKey={refreshKey} onUpdate={refresh} />
        )}

        {activeTab === 'employees' && (
          <EmployeeManager refreshKey={refreshKey} onUpdate={refresh} />
        )}
      </main>
    </div>
  );
};

export default Index;
