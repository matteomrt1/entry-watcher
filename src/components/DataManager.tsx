import { exportJSON, importJSON, loadData, formatHours, calculateHours } from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { useRef } from 'react';
import * as XLSX from 'xlsx';

interface DataManagerProps {
  onImport?: () => void;
}

export default function DataManager({ onImport }: DataManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

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
    <div className="flex gap-3">
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
