import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { addEntry, getLastAction } from '@/lib/attendance';
import { ScanLine, LogIn, LogOut, Camera, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface QRScannerProps {
  onScan?: () => void;
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
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
        (decodedText) => {
          handleScan(decodedText);
        },
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
      // Try parsing as JSON first
      const parsed = JSON.parse(decodedText);
      employeeName = parsed.name || parsed.nome || decodedText;
    } catch {
      // Plain text QR
      employeeName = decodedText.trim();
    }

    if (!employeeName) return;

    const lastAction = getLastAction(employeeName);
    const type = lastAction?.type === 'check-in' ? 'check-out' : 'check-in';
    const now = new Date();

    addEntry({
      employeeName,
      timestamp: now.toISOString(),
      type,
    });

    setLastScanned({
      name: employeeName,
      type,
      time: now.toLocaleTimeString('it-IT'),
    });

    toast.success(
      `${type === 'check-in' ? 'Ingresso' : 'Uscita'} registrato per ${employeeName}`,
    );

    onScan?.();

    // Brief pause to avoid duplicate scans
    stopScanning();
    setTimeout(() => startScanning(), 2000);
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

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
          <>
            <CameraOff className="mr-2 h-5 w-5" /> Ferma Scanner
          </>
        ) : (
          <>
            <Camera className="mr-2 h-5 w-5" /> Avvia Scanner
          </>
        )}
      </Button>

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
