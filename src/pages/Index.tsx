import { useState } from 'react';
import { ScanLine, ClipboardList, CalendarOff, BarChart3, Database, LayoutDashboard, CalendarDays, Users, Monitor, Wallet } from 'lucide-react';
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

type Tab = 'dashboard' | 'liveboard' | 'scan' | 'log' | 'calendar' | 'leave' | 'report' | 'timebank' | 'employees';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'liveboard', label: 'Live Board', icon: Monitor },
  { id: 'scan', label: 'Scanner', icon: ScanLine },
  { id: 'log', label: 'Registro', icon: ClipboardList },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'leave', label: 'Assenze', icon: CalendarOff },
  { id: 'report', label: 'Report', icon: BarChart3 },
  { id: 'timebank', label: 'Banca Ore', icon: Wallet },
  { id: 'employees', label: 'Risorse', icon: Users },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

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
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
              <Database className="h-3 w-3" />
              <span>Locale</span>
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
              <AttendanceLog refreshKey={refreshKey} limit={10} />
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Registro Completo</h2>
            <AttendanceLog refreshKey={refreshKey} limit={100} />
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

        {activeTab === 'employees' && (
          <EmployeeManager refreshKey={refreshKey} onUpdate={refresh} />
        )}
      </main>
    </div>
  );
};

export default Index;
