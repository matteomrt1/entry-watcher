import { exportJSON, importJSON, loadData, formatHours, calculateHours } from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Download, Upload, FileSpreadsheet, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

interface DataManagerProps {
  onImport?: () => void;
}

function formatHoursHMM(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function sumHMM(values: string[]): string {
  let totalMin = 0;
  for (const v of values) {
    if (!v) continue;
    const [h, m] = v.split(':').map(Number);
    totalMin += (h || 0) * 60 + (m || 0);
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export default function DataManager({ onImport }: DataManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExportMonthly = () => {
    const data = loadData();
    if (data.entries.length === 0) {
      toast.error('Nessun dato da esportare');
      return;
    }

    // Find all months that have data
    const monthsSet = new Set<string>();
    data.entries.forEach(e => {
      const d = new Date(e.timestamp);
      monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    const months = Array.from(monthsSet).sort();

    const names = [...new Set(data.entries.map(e => e.employeeName))].sort();
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

    const wb = XLSX.utils.book_new();

    for (const ym of months) {
      const [year, mon] = ym.split('-').map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();
      const sheetName = `${monthNames[mon - 1]} ${year}`;

      // Build rows: one per employee
      const rows: Record<string, string | number>[] = [];
      const dayTotals: string[] = new Array(daysInMonth).fill('');

      for (const name of names) {
        const row: Record<string, string | number> = { Nome: name };
        const employeeDayValues: string[] = [];

        for (let d = 1; d <= daysInMonth; d++) {
          const dayStart = new Date(year, mon - 1, d, 0, 0, 0);
          const dayEnd = new Date(year, mon - 1, d, 23, 59, 59);
          const hours = calculateHours(name, dayStart, dayEnd);
          const val = hours > 0 ? formatHoursHMM(hours) : '';
          row[String(d)] = val;
          employeeDayValues.push(val);
        }

        // Row total
        row['Totale'] = sumHMM(employeeDayValues);
        rows.push(row);

        // Accumulate day totals
        for (let i = 0; i < daysInMonth; i++) {
          if (employeeDayValues[i]) {
            dayTotals[i] = sumHMM([dayTotals[i], employeeDayValues[i]]);
          }
        }
      }

      // Total row
      const totalRow: Record<string, string | number> = { Nome: 'TOTALE' };
      for (let d = 1; d <= daysInMonth; d++) {
        totalRow[String(d)] = dayTotals[d - 1] || '';
      }
      totalRow['Totale'] = sumHMM(dayTotals);
      rows.push(totalRow);

      const headers = ['Nome', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)), 'Totale'];
      const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

      // Set column widths
      ws['!cols'] = [{ wch: 20 }, ...headers.slice(1).map(() => ({ wch: 6 }))];

      XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
    }

    XLSX.writeFile(wb, `presenze_mensili_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Export mensile esportato con successo');
  };

  const handleExportExcel = () => {
    const data = loadData();
    const wb = XLSX.utils.book_new();

    // Sheet 1: Registro presenze
    const entriesRows = data.entries
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(e => ({
        Risorsa: e.employeeName,
        Data: new Date(e.timestamp).toLocaleDateString('it-IT'),
        Ora: new Date(e.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        Tipo: e.type === 'check-in' ? 'Ingresso' : 'Uscita',
      }));
    const wsEntries = XLSX.utils.json_to_sheet(entriesRows);
    XLSX.utils.book_append_sheet(wb, wsEntries, 'Registro');

    // Sheet 2: Assenze
    const leavesRows = data.leaves.map(l => ({
      Risorsa: l.employeeName,
      Data: l.date,
      Tipo: l.type.charAt(0).toUpperCase() + l.type.slice(1),
      Ore: l.hours ?? '',
      Note: l.note ?? '',
    }));
    const wsLeaves = XLSX.utils.json_to_sheet(leavesRows);
    XLSX.utils.book_append_sheet(wb, wsLeaves, 'Assenze');

    // Sheet 3: Riepilogo ore per risorsa (ultimo mese)
    const names = [...new Set([...data.entries.map(e => e.employeeName), ...data.leaves.map(l => l.employeeName)])].sort();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const summaryRows = names.map(name => ({
      Risorsa: name,
      'Ore Mese': formatHours(calculateHours(name, monthStart, now)),
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Riepilogo');

    XLSX.writeFile(wb, `presenze_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('File Excel esportato con successo');
  };

  const handleExportJSON = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presenze_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Dati JSON esportati con successo');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (importJSON(text)) {
        toast.success('Dati importati con successo');
        onImport?.();
      } else {
        toast.error('File non valido');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex gap-3 flex-wrap">
      <Button variant="outline" onClick={handleExportMonthly} className="gap-2">
        <CalendarRange className="h-4 w-4" /> Export Mensile
      </Button>
      <Button variant="outline" onClick={handleExportExcel} className="gap-2">
        <FileSpreadsheet className="h-4 w-4" /> Esporta Excel
      </Button>
      <Button variant="outline" onClick={handleExportJSON} className="gap-2">
        <Download className="h-4 w-4" /> Esporta JSON
      </Button>
      <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
        <Upload className="h-4 w-4" /> Importa JSON
      </Button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </div>
  );
}
