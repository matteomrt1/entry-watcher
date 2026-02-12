import { exportJSON, importJSON } from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useRef } from 'react';

interface DataManagerProps {
  onImport?: () => void;
}

export default function DataManager({ onImport }: DataManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presenze_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Dati esportati con successo');
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
      <Button variant="outline" onClick={handleExport} className="gap-2">
        <Download className="h-4 w-4" /> Esporta JSON
      </Button>
      <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
        <Upload className="h-4 w-4" /> Importa JSON
      </Button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </div>
  );
}
