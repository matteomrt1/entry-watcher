import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { addEntry, getEmployees, getTodayStampCount } from '@/lib/attendance';
import { ScanLine, LogIn, LogOut, Camera, CameraOff, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface QRScannerProps {
  onScan?: () => void;
}

function getDefaultTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualTime, setManualTime] = useState(getDefaultTime);
  const [manualType, setManualType] = useState<'check-in' | 'check-out'>('check-in');
  const [lastScanned, setLastScanned] = useState<{
    name: string;
    type: 'check-in' | 'check-out';
    time: string;
  } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanning = async () => {
    if (!containerRef.current) return;
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { handleScan(decodedText); },
        () => {}
      );
      setScanning(true);
    } catch (err) {
      toast.error('Impossibile accedere alla fotocamera');
      console.error(err);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleScan = (decodedText: string) => {
    let employeeName: string;
    try {
      const parsed = JSON.parse(decodedText);
      employeeName = parsed.name || parsed.nome || decodedText;
    } catch {
      employeeName = decodedText.trim();
    }
    if (!employeeName) return;

    const count = getTodayStampCount(employeeName);
    if (count >= 4) {
      toast.error(`${employeeName}: hai già completato le tue 4 timbrature oggi.`);
      return;
    }
    const type: 'check-in' | 'check-out' = count % 2 === 0 ? 'check-in' : 'check-out';
    const now = new Date();

    addEntry({ employeeName, timestamp: now.toISOString(), type });
    setLastScanned({ name: employeeName, type, time: now.toLocaleTimeString('it-IT') });
    toast.success(`${type === 'check-in' ? 'Ingresso' : 'Uscita'} registrato per ${employeeName}`);
    onScan?.();
    stopScanning();
    setTimeout(() => startScanning(), 2000);
  };

  const handleManualEntry = () => {
    const name = manualName.trim();
    if (!name) {
      toast.error('Inserisci il nome della risorsa');
      return;
    }
    if (!manualDate || !manualTime) {
      toast.error('Inserisci data e orario');
      return;
    }

    const timestamp = new Date(`${manualDate}T${manualTime}:00`).toISOString();
    addEntry({ employeeName: name, timestamp, type: manualType });

    setLastScanned({ name, type: manualType, time: manualTime });
    toast.success(`${manualType === 'check-in' ? 'Ingresso' : 'Uscita'} manuale registrato per ${name}`);
    setManualName('');
    setManualTime(getDefaultTime());
    setManualDate(new Date().toISOString().slice(0, 10));
    onScan?.();
  };

  useEffect(() => {
    return () => { stopScanning(); };
  }, []);

  const existingEmployees = getEmployees();

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Scanner area */}
      <div className="relative w-full max-w-sm">
        <div
          className={`relative overflow-hidden rounded-xl border-2 ${
            scanning ? 'border-accent scan-pulse' : 'border-border'
          } bg-primary/5 aspect-square flex items-center justify-center`}
        >
          <div id="qr-reader" ref={containerRef} className="w-full h-full" />
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <ScanLine className="h-16 w-16 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Scanner non attivo</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <Button
        size="lg"
        onClick={scanning ? stopScanning : startScanning}
        className={scanning ? 'bg-destructive hover:bg-destructive/90' : 'bg-accent hover:bg-accent/90'}
      >
        {scanning ? (
          <><CameraOff className="mr-2 h-5 w-5" /> Ferma Scanner</>
        ) : (
          <><Camera className="mr-2 h-5 w-5" /> Avvia Scanner</>
        )}
      </Button>

      {/* Manual Entry */}
      <div className="w-full max-w-sm border rounded-xl p-4 bg-card space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <UserPlus className="h-4 w-4" />
          Inserimento Manuale
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="manual-name">Nome Risorsa</Label>
            <Input
              id="manual-name"
              placeholder="es. Mario Rossi"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              list="employee-suggestions"
              maxLength={100}
            />
            {existingEmployees.length > 0 && (
              <datalist id="employee-suggestions">
                {existingEmployees.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="manual-date">Data</Label>
              <Input
                id="manual-date"
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="manual-time">Orario</Label>
              <Input
                id="manual-time"
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={manualType} onValueChange={(v) => setManualType(v as 'check-in' | 'check-out')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="check-in">
                  <span className="flex items-center gap-2"><LogIn className="h-4 w-4" /> Ingresso</span>
                </SelectItem>
                <SelectItem value="check-out">
                  <span className="flex items-center gap-2"><LogOut className="h-4 w-4" /> Uscita</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleManualEntry} className="w-full">
            <UserPlus className="mr-2 h-4 w-4" /> Registra
          </Button>
        </div>
      </div>

      {/* Last scan result */}
      {lastScanned && (
        <div className="fade-in stat-card w-full max-w-sm text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {lastScanned.type === 'check-in' ? (
              <LogIn className="h-5 w-5 text-accent" />
            ) : (
              <LogOut className="h-5 w-5 text-warning" />
            )}
            <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {lastScanned.type === 'check-in' ? 'Ingresso' : 'Uscita'}
            </span>
          </div>
          <p className="text-xl font-bold">{lastScanned.name}</p>
          <p className="font-mono text-sm text-muted-foreground">{lastScanned.time}</p>
        </div>
      )}
    </div>
  );
}
