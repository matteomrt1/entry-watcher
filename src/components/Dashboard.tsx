import { useMemo } from 'react';
import { loadData, getEmployees, calculateHours, formatHours, getLastAction } from '@/lib/attendance';
import { Users, Clock, UserCheck, UserX, TrendingUp, CalendarDays } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface DashboardProps {
  refreshKey?: number;
}

export default function Dashboard({ refreshKey }: DashboardProps) {
  const employees = useMemo(() => getEmployees(), [refreshKey]);

  const today = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  // Who's currently checked in
  const { presentToday, absentToday } = useMemo(() => {
    const present: string[] = [];
    const absent: string[] = [];
    for (const emp of employees) {
      const last = getLastAction(emp);
      if (last && last.type === 'check-in') {
        const lastDate = new Date(last.timestamp).toISOString().split('T')[0];
        if (lastDate === today) {
          present.push(emp);
          continue;
        }
      }
      absent.push(emp);
    }
    return { presentToday: present, absentToday: absent };
  }, [employees, today, refreshKey]);

  // Weekly hours per employee (current week Mon-Sun)
  const weeklyData = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59);

    return employees.map(emp => ({
      name: emp.length > 12 ? emp.slice(0, 12) + '…' : emp,
      fullName: emp,
      ore: calculateHours(emp, monday, sunday),
    }));
  }, [employees, refreshKey]);

  const totalWeeklyHours = useMemo(() => weeklyData.reduce((s, d) => s + d.ore, 0), [weeklyData]);

  // Daily hours for today per employee
  const todayData = useMemo(() => {
    const dayStart = new Date(today + 'T00:00:00');
    const dayEnd = new Date(today + 'T23:59:59');
    return employees.map(emp => ({
      name: emp.length > 12 ? emp.slice(0, 12) + '…' : emp,
      ore: calculateHours(emp, dayStart, dayEnd),
    })).filter(d => d.ore > 0);
  }, [employees, today, refreshKey]);

  // Leave breakdown this month
  const leaveData = useMemo(() => {
    const data = loadData();
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthLeaves = data.leaves.filter(l => l.date.startsWith(monthStr));
    const counts = { ferie: 0, permesso: 0, malattia: 0, altro: 0 };
    monthLeaves.forEach(l => counts[l.type]++);
    return [
      { name: 'Ferie', value: counts.ferie, color: 'hsl(38, 92%, 50%)' },
      { name: 'Permessi', value: counts.permesso, color: 'hsl(220, 60%, 50%)' },
      { name: 'Malattia', value: counts.malattia, color: 'hsl(0, 72%, 51%)' },
      { name: 'Altro', value: counts.altro, color: 'hsl(220, 10%, 60%)' },
    ].filter(d => d.value > 0);
  }, [refreshKey]);

  // Entries today count
  const entriesToday = useMemo(() => {
    const data = loadData();
    return data.entries.filter(e => e.timestamp.startsWith(today)).length;
  }, [today, refreshKey]);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card text-center">
          <Users className="h-5 w-5 text-accent mx-auto mb-1" />
          <p className="text-3xl font-bold font-mono">{employees.length}</p>
          <p className="text-xs text-muted-foreground">Risorse Totali</p>
        </div>
        <div className="stat-card text-center">
          <UserCheck className="h-5 w-5 text-accent mx-auto mb-1" />
          <p className="text-3xl font-bold font-mono">{presentToday.length}</p>
          <p className="text-xs text-muted-foreground">Presenti Oggi</p>
        </div>
        <div className="stat-card text-center">
          <TrendingUp className="h-5 w-5 text-warning mx-auto mb-1" />
          <p className="text-3xl font-bold font-mono">{entriesToday}</p>
          <p className="text-xs text-muted-foreground">Movimenti Oggi</p>
        </div>
        <div className="stat-card text-center">
          <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-3xl font-bold font-mono">{formatHours(totalWeeklyHours)}</p>
          <p className="text-xs text-muted-foreground">Ore Settimana</p>
        </div>
      </div>

      {/* Present / Absent */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-accent" /> Presenti Adesso
          </h3>
          {presentToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuno presente</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {presentToday.map(name => (
                <span key={name} className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="stat-card">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <UserX className="h-4 w-4 text-destructive" /> Assenti
          </h3>
          {absentToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tutti presenti</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {absentToday.map(name => (
                <span key={name} className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm font-medium">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekly hours chart */}
      {weeklyData.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Ore Settimanali per Risorsa
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [formatHours(value), 'Ore']}
                contentStyle={{
                  background: 'hsl(0, 0%, 100%)',
                  border: '1px solid hsl(220, 15%, 88%)',
                  borderRadius: '8px',
                  fontSize: 13,
                }}
              />
              <Bar dataKey="ore" fill="hsl(155, 65%, 40%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Today hours + Leaves pie side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {todayData.length > 0 && (
          <div className="stat-card">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
              Ore Lavorate Oggi
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={todayData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                <Tooltip
                  formatter={(value: number) => [formatHours(value), 'Ore']}
                  contentStyle={{
                    background: 'hsl(0, 0%, 100%)',
                    border: '1px solid hsl(220, 15%, 88%)',
                    borderRadius: '8px',
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="ore" fill="hsl(220, 60%, 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {leaveData.length > 0 && (
          <div className="stat-card">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
              Assenze del Mese
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={leaveData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {leaveData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
